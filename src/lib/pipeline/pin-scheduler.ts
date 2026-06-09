import { db } from "@/lib/db";
import { pinQueue } from "@/lib/db/schema";
import { createPin, getPinterestBoardId } from "@/lib/services/pinterest";
import { getConfigValue, shouldRetry } from "@/lib/pipeline/base";
import { ConfigKeys } from "@/lib/constants";
import { eq, and, sql, lte, gte } from "drizzle-orm";

const DEFAULT_POSTING_SCHEDULE = {
  timezone: "America/New_York",
  hours: [7, 8, 9, 11, 12, 14, 15, 17, 18, 20],
};

function getCurrentHourInTimezone(timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

function getRemainingSlots(schedule: { timezone: string; hours: number[] }, dailyTarget: number): number {
  const currentHour = getCurrentHourInTimezone(schedule.timezone);
  const remainingHours = schedule.hours.filter((h) => h >= currentHour);
  const slotsPerHour = Math.ceil(dailyTarget / Math.max(schedule.hours.length, 1));
  const slots = remainingHours.length * slotsPerHour;
  return Math.max(slots, 1); // minimum 1 to avoid division by zero
}

async function resolveBoardId(itemBoardId: string | null): Promise<string> {
  if (itemBoardId) return itemBoardId;
  return getPinterestBoardId();
}

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

  // Check per-type daily limits for multiboard and recycled pins
  const maxMultiboard = parseInt(
    await getConfigValue(ConfigKeys.MAX_MULTIBOARD_PINS_PER_DAY, "15"),
    10
  );
  const maxRecycled = parseInt(
    await getConfigValue(ConfigKeys.MAX_RECYCLED_PINS_PER_DAY, "10"),
    10
  );

  const [{ count: multiboardToday }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pinQueue)
    .where(
      and(
        eq(pinQueue.status, "posted"),
        eq(pinQueue.pinType, "multiboard"),
        gte(pinQueue.postedAt, todayStart)
      )
    );

  const [{ count: recycledToday }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pinQueue)
    .where(
      and(
        eq(pinQueue.status, "posted"),
        eq(pinQueue.pinType, "recycled"),
        gte(pinQueue.postedAt, todayStart)
      )
    );

  // Build list of pin types that have hit their daily cap — these should be skipped
  const cappedTypes: string[] = [];
  if (multiboardToday >= maxMultiboard) cappedTypes.push("multiboard");
  if (recycledToday >= maxRecycled) cappedTypes.push("recycled");

  // Count pending pins that are ready to post
  const now = new Date();
  const [{ count: pendingReady }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pinQueue)
    .where(
      and(
        eq(pinQueue.status, "pending"),
        lte(pinQueue.scheduledAt, now)
      )
    );

  // Parse posting schedule config
  const scheduleRaw = await getConfigValue(
    ConfigKeys.PIN_POSTING_SCHEDULE,
    JSON.stringify(DEFAULT_POSTING_SCHEDULE)
  );
  let schedule: { timezone: string; hours: number[] };
  try {
    schedule = JSON.parse(scheduleRaw);
  } catch {
    schedule = DEFAULT_POSTING_SCHEDULE;
  }

  // Dynamically calculate batch size
  const remainingSlots = getRemainingSlots(schedule, maxPerDay);
  const remainingForDay = maxPerDay - postedToday;
  const dynamicTarget = Math.ceil(pendingReady / remainingSlots);
  const target = Math.max(1, Math.min(dynamicTarget, remainingForDay));

  console.log(
    `[post-pins] Backlog: ${pendingReady} ready, ${remainingSlots} slots remaining today → posting ${target} this run`
  );

  let processed = 0;

  // Build the type exclusion clause for capped pin types (for raw SQL subquery)
  const typeExclusion = cappedTypes.length > 0
    ? `AND pin_type NOT IN (${cappedTypes.map((t) => `'${t}'`).join(",")})`
    : "";

  for (let i = 0; i < target; i++) {
    const now = new Date();
    const [item] = await db
      .update(pinQueue)
      .set({ status: "posting" })
      .where(
        and(
          eq(pinQueue.status, "pending"),
          lte(pinQueue.scheduledAt, now),
          ...(cappedTypes.length > 0
            ? [sql`${pinQueue.pinType} NOT IN (${sql.join(cappedTypes.map(t => sql`${t}`), sql`, `)})`]
            : []),
          sql`${pinQueue.id} = (
            SELECT ${pinQueue.id} FROM ${pinQueue}
            WHERE ${pinQueue.status} = 'pending'
            AND ${pinQueue.scheduledAt} <= ${now.toISOString()}
            ${sql.raw(typeExclusion)}
            ORDER BY ${pinQueue.scheduledAt} ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )`
        )
      )
      .returning();

    if (!item) break;

    try {
      const boardId = await resolveBoardId(item.boardId);
      const pin = await createPin({
        boardId,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        link: item.link,
        altText: item.altText ?? undefined,
      });

      await db
        .update(pinQueue)
        .set({
          status: "posted",
          postedAt: new Date(),
          pinterestPinId: pin.id,
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
