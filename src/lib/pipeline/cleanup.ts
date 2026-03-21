import { db } from "@/lib/db";
import { articles, keywords, pipelineRuns } from "@/lib/db/schema";
import { ArticleStatus, KeywordStatus } from "@/lib/constants";
import { sendAlert, sendDailySummary } from "@/lib/services/alerts";
import { eq, sql, and, lt } from "drizzle-orm";

// Map failed articles back to their retry-eligible status
const RETRY_STATUS_MAP: Record<string, string> = {
  content_generating: ArticleStatus.DRAFT,
  image_generating: ArticleStatus.CONTENT_READY,
  pin_generating: ArticleStatus.IMAGE_READY,
  publishing: ArticleStatus.PIN_READY,
};

export async function cleanup(): Promise<{ processed: number }> {
  let processed = 0;

  // 1. Retry transient failures (articles stuck in intermediate states)
  const failedArticles = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.status, ArticleStatus.FAILED),
        lt(articles.retryCount, 6) // Allow extra retries during cleanup
      )
    );

  for (const article of failedArticles) {
    // Try to determine which stage it failed at from failure_reason or retry
    const retryStatus = ArticleStatus.DRAFT; // Reset to beginning as safe default

    await db
      .update(articles)
      .set({
        status: retryStatus,
        retryCount: 0,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    processed++;
  }

  // 2. Reset stuck articles (in generating states for >15 min — Vercel max is 60s)
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const stuckStatuses = [
    ArticleStatus.CONTENT_GENERATING,
    ArticleStatus.IMAGE_GENERATING,
    ArticleStatus.PIN_GENERATING,
    ArticleStatus.PUBLISHING,
  ];

  for (const status of stuckStatuses) {
    const retryStatus = RETRY_STATUS_MAP[status] || ArticleStatus.DRAFT;

    const result = await db
      .update(articles)
      .set({
        status: retryStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(articles.status, status),
          lt(articles.updatedAt, fifteenMinAgo)
        )
      )
      .returning();

    processed += result.length;
  }

  // 3. Gather stats for summary
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${articles.status} = 'published')::int`,
      failed: sql<number>`count(*) filter (where ${articles.status} = 'failed')::int`,
      inProgress: sql<number>`count(*) filter (where ${articles.status} not in ('published', 'failed', 'draft'))::int`,
    })
    .from(articles);

  const [keywordStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${keywords.status} = 'new')::int`,
    })
    .from(keywords);

  // 4. Send summary
  try {
    await sendDailySummary({
      keywordsDiscovered: keywordStats?.total ?? 0,
      keywordsApproved: (keywordStats?.total ?? 0) - (keywordStats?.pending ?? 0),
      articlesPublished: stats?.published ?? 0,
      articlesFailed: stats?.failed ?? 0,
      pinsCreated: stats?.published ?? 0,
    });
  } catch (error) {
    console.error("Failed to send summary:", error);
  }

  // 5. Alert on persistent failures
  const permanentlyFailed = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.status, ArticleStatus.FAILED),
        sql`${articles.retryCount} >= 6`
      )
    );

  if (permanentlyFailed.length > 0) {
    try {
      await sendAlert(
        "Permanently Failed Articles",
        `${permanentlyFailed.length} articles have permanently failed after all retries:\n\n` +
          permanentlyFailed
            .map((a) => `- ${a.slug}: ${a.failureReason}`)
            .join("\n")
      );
    } catch (error) {
      console.error("Failed to send failure alert:", error);
    }
  }

  return { processed };
}
