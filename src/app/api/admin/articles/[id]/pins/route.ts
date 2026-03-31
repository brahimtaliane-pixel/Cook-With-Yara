import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pinQueue, pinAnalytics } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const pins = await db
    .select({
      id: pinQueue.id,
      pinDesign: pinQueue.pinDesign,
      title: pinQueue.title,
      description: pinQueue.description,
      imageUrl: pinQueue.imageUrl,
      link: pinQueue.link,
      altText: pinQueue.altText,
      pinType: pinQueue.pinType,
      status: pinQueue.status,
      boardId: pinQueue.boardId,
      scheduledAt: pinQueue.scheduledAt,
      postedAt: pinQueue.postedAt,
      pinterestPinId: pinQueue.pinterestPinId,
      performanceScore: pinQueue.performanceScore,
      failureReason: pinQueue.failureReason,
    })
    .from(pinQueue)
    .where(eq(pinQueue.articleId, id))
    .orderBy(desc(pinQueue.scheduledAt));

  // Get latest analytics for posted pins
  const pinsWithAnalytics = await Promise.all(
    pins.map(async (pin) => {
      if (!pin.pinterestPinId) return { ...pin, analytics: null };

      const [latest] = await db
        .select({
          impressions: pinAnalytics.impressions,
          saves: pinAnalytics.saves,
          clicks: pinAnalytics.clicks,
          closeups: pinAnalytics.closeups,
          snapshotAt: pinAnalytics.snapshotAt,
        })
        .from(pinAnalytics)
        .where(eq(pinAnalytics.pinQueueId, pin.id))
        .orderBy(desc(pinAnalytics.snapshotAt))
        .limit(1);

      return { ...pin, analytics: latest ?? null };
    })
  );

  return NextResponse.json({ pins: pinsWithAnalytics });
}
