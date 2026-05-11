import { db } from "@/lib/db";
import { articles, pinQueue } from "@/lib/db/schema";
import { ArticleStatus } from "@/lib/constants";
import { eq, and, lt, sql } from "drizzle-orm";

const STUCK_THRESHOLD_MIN = 15;
const STUCK_PUBLISHING_MIN = 5;
const STUCK_PIN_POSTING_MIN = 30;

export async function runPipelineMonitor(): Promise<{ processed: number }> {
  let processed = 0;

  processed += await recoverStuckImageGenerating();
  processed += await recoverStuckContentGenerating();
  processed += await recoverStuckPinGenerating();
  processed += await recoverStuckPublishing();
  processed += await recoverStuckPinPosting();

  return { processed };
}

/** image_generating >15 min — Nano Banana is synchronous, so stuck means the request hung or crashed; reset. */
async function recoverStuckImageGenerating(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60 * 1000);
  const result = await db
    .update(articles)
    .set({ status: ArticleStatus.CONTENT_READY, updatedAt: new Date() })
    .where(
      and(
        eq(articles.status, ArticleStatus.IMAGE_GENERATING),
        lt(articles.updatedAt, cutoff)
      )
    )
    .returning();

  if (result.length > 0) {
    console.log(`[monitor] Reset ${result.length} stuck image_generating articles to content_ready`);
  }
  return result.length;
}

/** content_generating >15 min — no external state, just reset */
async function recoverStuckContentGenerating(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60 * 1000);
  const result = await db
    .update(articles)
    .set({ status: ArticleStatus.DRAFT, updatedAt: new Date() })
    .where(
      and(
        eq(articles.status, ArticleStatus.CONTENT_GENERATING),
        lt(articles.updatedAt, cutoff)
      )
    )
    .returning();

  if (result.length > 0) {
    console.log(`[monitor] Reset ${result.length} stuck content_generating articles to draft`);
  }
  return result.length;
}

/** pin_generating >15 min — check if pin images already exist */
async function recoverStuckPinGenerating(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60 * 1000);
  const stuck = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.status, ArticleStatus.PIN_GENERATING),
        lt(articles.updatedAt, cutoff)
      )
    );

  let recovered = 0;

  for (const article of stuck) {
    if (article.pinImageUrl && article.pinImageUrl2) {
      // Both pin images exist — advance to pin_ready
      console.log(`[monitor] pin_generating article ${article.id}: pin images exist, advancing to pin_ready`);
      await db
        .update(articles)
        .set({ status: ArticleStatus.PIN_READY, updatedAt: new Date() })
        .where(eq(articles.id, article.id));
    } else {
      // Missing pin images — reset to image_ready
      console.log(`[monitor] pin_generating article ${article.id}: missing pin images, resetting to image_ready`);
      await db
        .update(articles)
        .set({ status: ArticleStatus.IMAGE_READY, updatedAt: new Date() })
        .where(eq(articles.id, article.id));
    }
    recovered++;
  }

  return recovered;
}

/** publishing >5 min — reset to pin_ready */
async function recoverStuckPublishing(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_PUBLISHING_MIN * 60 * 1000);
  const result = await db
    .update(articles)
    .set({ status: ArticleStatus.PIN_READY, updatedAt: new Date() })
    .where(
      and(
        eq(articles.status, ArticleStatus.PUBLISHING),
        lt(articles.updatedAt, cutoff)
      )
    )
    .returning();

  if (result.length > 0) {
    console.log(`[monitor] Reset ${result.length} stuck publishing articles to pin_ready`);
  }
  return result.length;
}

/** Pins stuck in "posting" >30 min — reset to pending, reschedule +5 min */
async function recoverStuckPinPosting(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_PIN_POSTING_MIN * 60 * 1000);
  const rescheduleAt = new Date(Date.now() + 5 * 60 * 1000);

  const result = await db
    .update(pinQueue)
    .set({
      status: "pending",
      scheduledAt: rescheduleAt,
    })
    .where(
      and(
        eq(pinQueue.status, "posting"),
        sql`${pinQueue.createdAt} < ${cutoff.toISOString()}::timestamp`
      )
    )
    .returning();

  if (result.length > 0) {
    console.log(`[monitor] Reset ${result.length} stuck posting pins to pending (+5min)`);
  }
  return result.length;
}
