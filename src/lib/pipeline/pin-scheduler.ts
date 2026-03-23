import { db } from "@/lib/db";
import { pinQueue } from "@/lib/db/schema";
import { postPin } from "@/lib/services/pinterest-unified";
import { getPinterestBoardId } from "@/lib/services/pinterest";
import { getConfigValue, shouldRetry } from "@/lib/pipeline/base";
import { ConfigKeys } from "@/lib/constants";
import { eq, and, sql, lte, gte } from "drizzle-orm";

export async function processNextPin(runId: string): Promise<{ processed: number }> {
  // Check daily limit
  const maxPerDay = parseInt(
    await getConfigValue(ConfigKeys.MAX_PINS_PER_DAY, "40"),
    10
  );
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: postedToday }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pinQueue)
    .where(
      and(
        eq(pinQueue.status, "posted"),
        gte(pinQueue.postedAt, todayStart)
      )
    );

  if (postedToday >= maxPerDay) {
    console.log(`[post-pins] Daily limit reached (${postedToday}/${maxPerDay})`);
    return { processed: 0 };
  }

  // How many to post this run
  const pinsPerRun = parseInt(
    await getConfigValue(ConfigKeys.PINS_PER_CRON_RUN, "1"),
    10
  );
  const remaining = maxPerDay - postedToday;
  const target = Math.min(pinsPerRun, remaining);

  let processed = 0;
  const boardId = await getPinterestBoardId();

  for (let i = 0; i < target; i++) {
    const now = new Date();
    const [item] = await db
      .update(pinQueue)
      .set({ status: "posting" })
      .where(
        and(
          eq(pinQueue.status, "pending"),
          lte(pinQueue.scheduledAt, now),
          sql`${pinQueue.id} = (
            SELECT ${pinQueue.id} FROM ${pinQueue}
            WHERE ${pinQueue.status} = 'pending'
            AND ${pinQueue.scheduledAt} <= ${now.toISOString()}
            ORDER BY ${pinQueue.scheduledAt} ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )`
        )
      )
      .returning();

    if (!item) break;

    try {
      const result = await postPin({
        boardId,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        link: item.link,
      });

      await db
        .update(pinQueue)
        .set({
          status: "posted",
          postedAt: new Date(),
          pinterestPinId: result.pinId,
        })
        .where(eq(pinQueue.id, item.id));

      processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const newRetryCount = item.retryCount + 1;

      await db
        .update(pinQueue)
        .set({
          status: shouldRetry(newRetryCount) ? "pending" : "failed",
          retryCount: newRetryCount,
          failureReason: message,
          ...(shouldRetry(newRetryCount)
            ? { scheduledAt: new Date(Date.now() + 5 * 60 * 1000) }
            : {}),
        })
        .where(eq(pinQueue.id, item.id));

      // Don't throw — continue with next pin
      console.error(`[post-pins] Failed to post pin ${item.id}:`, message);
    }
  }

  return { processed };
}
