import { db } from "@/lib/db";
import { pinQueue } from "@/lib/db/schema";
import { postPin } from "@/lib/services/pinterest-unified";
import { getPinterestBoardId } from "@/lib/services/pinterest";
import { randomDelay } from "@/lib/services/pinterest-direct";
import { shouldRetry } from "@/lib/pipeline/base";
import { eq, and, sql, lte } from "drizzle-orm";

export async function processNextPin(runId: string): Promise<{ processed: number }> {
  // Add a random initial delay (30-90s) to vary posting times
  await randomDelay(30_000, 90_000);

  // Atomically claim one pending pin where scheduledAt <= now
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

  if (!item) {
    return { processed: 0 };
  }

  try {
    const boardId = await getPinterestBoardId();

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

    return { processed: 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const newRetryCount = item.retryCount + 1;

    await db
      .update(pinQueue)
      .set({
        status: shouldRetry(newRetryCount) ? "pending" : "failed",
        retryCount: newRetryCount,
        failureReason: message,
        // On retry, delay the next attempt by 5 minutes
        ...(shouldRetry(newRetryCount)
          ? { scheduledAt: new Date(Date.now() + 5 * 60 * 1000) }
          : {}),
      })
      .where(eq(pinQueue.id, item.id));

    throw error;
  }
}
