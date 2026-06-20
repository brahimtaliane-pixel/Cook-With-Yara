import { db } from "@/lib/db";
import { pinQueue } from "@/lib/db/schema";
import type { PinQueueItem } from "@/lib/db/schema";
import {
  createPin,
  createVideoPin,
  registerVideoMedia,
  uploadVideoToMedia,
  getMediaStatus,
  getPinterestBoardId,
} from "@/lib/services/pinterest";
import { getConfigValue, shouldRetry } from "@/lib/pipeline/base";
import {
  ConfigKeys,
  MediaType,
  PinQueueStatus,
  PinType,
  VIDEO_DEFAULTS,
} from "@/lib/constants";
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
  const maxVideo = parseInt(
    await getConfigValue(
      ConfigKeys.MAX_VIDEO_PINS_PER_DAY,
      String(VIDEO_DEFAULTS.MAX_PINS_PER_DAY)
    ),
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

  const [{ count: videoToday }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pinQueue)
    .where(
      and(
        eq(pinQueue.status, PinQueueStatus.POSTED),
        eq(pinQueue.pinType, PinType.VIDEO),
        gte(pinQueue.postedAt, todayStart)
      )
    );

  // Build list of pin types that have hit their daily cap — these should be skipped
  const cappedTypes: string[] = [];
  if (multiboardToday >= maxMultiboard) cappedTypes.push("multiboard");
  if (recycledToday >= maxRecycled) cappedTypes.push("recycled");
  if (videoToday >= maxVideo) cappedTypes.push(PinType.VIDEO);

  // Resume any video pins already registered+uploaded to Pinterest, whose
  // transcode we're waiting on. Runs even when no new pins are due. Respects
  // the daily video cap so we never exceed it.
  let processed = 0;
  if (videoToday < maxVideo) {
    processed += await resumeProcessingVideoPins(maxVideo - videoToday);
  }

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
      if (item.mediaType === MediaType.VIDEO) {
        // Video: register media + upload the MP4, then hand off to the resume
        // pass (transcode is async). Doesn't count as "posted" until the pin is
        // actually created on a later run.
        await startVideoPin(item);
        processed++;
        continue;
      }

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

// === Video pin helpers ===

/**
 * Register + upload a video pin's MP4 to Pinterest, then park it as
 * `media_processing` for the resume pass to finish once transcode completes.
 * The claimed item arrives here with status `posting`.
 */
async function startVideoPin(item: PinQueueItem): Promise<void> {
  if (!item.videoUrl) throw new Error("Video pin has no videoUrl");

  // Already registered (e.g. a retry after upload) — just move to processing.
  if (!item.pinterestMediaId) {
    const res = await fetch(item.videoUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch reel (${res.status}) from ${item.videoUrl}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const media = await registerVideoMedia();
    await uploadVideoToMedia(media.upload_url, media.upload_parameters, buffer);

    await db
      .update(pinQueue)
      .set({
        pinterestMediaId: media.media_id,
        status: PinQueueStatus.MEDIA_PROCESSING,
      })
      .where(eq(pinQueue.id, item.id));
  } else {
    await db
      .update(pinQueue)
      .set({ status: PinQueueStatus.MEDIA_PROCESSING })
      .where(eq(pinQueue.id, item.id));
  }
}

/**
 * Poll Pinterest transcode for video pins parked in `media_processing` and
 * create the pin once the media succeeds. Returns the number of pins posted.
 * Atomically claims each row so concurrent runs can't double-post.
 */
async function resumeProcessingVideoPins(limit: number): Promise<number> {
  let posted = 0;

  for (let i = 0; i < limit; i++) {
    // Claim one media_processing row.
    const [item] = await db
      .update(pinQueue)
      .set({ status: PinQueueStatus.POSTING })
      .where(
        and(
          eq(pinQueue.status, PinQueueStatus.MEDIA_PROCESSING),
          sql`${pinQueue.id} = (
            SELECT ${pinQueue.id} FROM ${pinQueue}
            WHERE ${pinQueue.status} = ${PinQueueStatus.MEDIA_PROCESSING}
            ORDER BY ${pinQueue.scheduledAt} ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )`
        )
      )
      .returning();

    if (!item) break;

    try {
      if (!item.pinterestMediaId) throw new Error("No pinterest_media_id on row");

      const media = await getMediaStatus(item.pinterestMediaId);

      if (media.status === "succeeded") {
        const boardId = await resolveBoardId(item.boardId);
        const pin = await createVideoPin({
          boardId,
          title: item.title,
          description: item.description,
          link: item.link,
          mediaId: item.pinterestMediaId,
          coverImageUrl: item.coverImageUrl ?? item.imageUrl,
          altText: item.altText ?? undefined,
        });

        await db
          .update(pinQueue)
          .set({
            status: PinQueueStatus.POSTED,
            postedAt: new Date(),
            pinterestPinId: pin.id,
          })
          .where(eq(pinQueue.id, item.id));

        posted++;
      } else if (media.status === "failed") {
        throw new Error("Pinterest media transcode failed");
      } else {
        // Still registered/processing — park it again for the next run.
        await db
          .update(pinQueue)
          .set({ status: PinQueueStatus.MEDIA_PROCESSING })
          .where(eq(pinQueue.id, item.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const newRetryCount = item.retryCount + 1;
      const willRetry = shouldRetry(newRetryCount);
      await db
        .update(pinQueue)
        .set({
          // Retry by re-parking as media_processing; give up to failed otherwise.
          status: willRetry
            ? PinQueueStatus.MEDIA_PROCESSING
            : PinQueueStatus.FAILED,
          retryCount: newRetryCount,
          failureReason: message,
        })
        .where(eq(pinQueue.id, item.id));
      console.error(`[post-pins] Video pin ${item.id} resume failed:`, message);
    }
  }

  return posted;
}
