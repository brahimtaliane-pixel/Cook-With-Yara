import { db } from "@/lib/db";
import { pinQueue, pinAnalytics } from "@/lib/db/schema";
import { fetchPinAnalytics } from "@/lib/services/pinterest";
import { eq, and, sql, gte, isNotNull } from "drizzle-orm";

const MAX_PINS_PER_RUN = 50;
const RATE_LIMIT_MS = 200;

function computePerformanceScore(data: {
  impressions: number;
  saves: number;
  clicks: number;
  closeups: number;
}): number {
  return Math.round(
    data.saves * 10 +
      data.clicks * 5 +
      data.closeups * 2 +
      data.impressions * 0.01
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function trackPinAnalytics(): Promise<{ processed: number }> {
  // Get posted pins from last 90 days with a pinterestPinId
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const pins = await db
    .select({
      id: pinQueue.id,
      pinterestPinId: pinQueue.pinterestPinId,
    })
    .from(pinQueue)
    .where(
      and(
        eq(pinQueue.status, "posted"),
        isNotNull(pinQueue.pinterestPinId),
        gte(pinQueue.postedAt, ninetyDaysAgo)
      )
    )
    .limit(MAX_PINS_PER_RUN);

  if (pins.length === 0) {
    console.log("[track-analytics] No posted pins to track");
    return { processed: 0 };
  }

  let processed = 0;

  for (const pin of pins) {
    if (!pin.pinterestPinId) continue;

    try {
      const analytics = await fetchPinAnalytics(pin.pinterestPinId);
      const score = computePerformanceScore(analytics);

      // Store analytics snapshot
      await db.insert(pinAnalytics).values({
        pinQueueId: pin.id,
        pinterestPinId: pin.pinterestPinId,
        impressions: analytics.impressions,
        saves: analytics.saves,
        clicks: analytics.clicks,
        closeups: analytics.closeups,
      });

      // Update performance score on pinQueue for quick lookups
      await db
        .update(pinQueue)
        .set({ performanceScore: score })
        .where(eq(pinQueue.id, pin.id));

      processed++;
    } catch (err) {
      console.error(
        `[track-analytics] Failed for pin ${pin.pinterestPinId}:`,
        err
      );
    }

    // Rate limiting
    if (processed < pins.length) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log(`[track-analytics] Tracked ${processed}/${pins.length} pins`);
  return { processed };
}
