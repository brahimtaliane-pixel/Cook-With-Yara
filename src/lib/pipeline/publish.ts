import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { ArticleStatus } from "@/lib/constants";
import { createPin } from "@/lib/services/pinterest";
import { getCanonicalUrl } from "@/lib/utils/seo";
import { shouldRetry } from "@/lib/pipeline/base";
import { eq, and, sql } from "drizzle-orm";

export async function publishAndPin(): Promise<{ processed: number }> {
  // Atomically claim one pin_ready article
  const [article] = await db
    .update(articles)
    .set({ status: ArticleStatus.PUBLISHING, updatedAt: new Date() })
    .where(
      and(
        eq(articles.status, ArticleStatus.PIN_READY),
        sql`${articles.id} = (
          SELECT ${articles.id} FROM ${articles}
          WHERE ${articles.status} = ${ArticleStatus.PIN_READY}
          ORDER BY ${articles.createdAt} ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )`
      )
    )
    .returning();

  if (!article) {
    return { processed: 0 };
  }

  try {
    const canonicalUrl = getCanonicalUrl(article.slug);

    // Trigger ISR revalidation
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithlucia.com";
    await fetch(`${siteUrl}/api/revalidate?slug=${article.slug}&secret=${process.env.CRON_SECRET}`);

    // Post pin to Pinterest
    const boardId = process.env.PINTEREST_BOARD_ID;
    if (!boardId) {
      throw new Error("PINTEREST_BOARD_ID not configured");
    }

    const pin = await createPin({
      boardId,
      title: article.title || "Delicious Recipe",
      description: article.metaDescription || "",
      imageUrl: article.pinImageUrl || article.heroImageUrl || "",
      link: canonicalUrl,
    });

    await db
      .update(articles)
      .set({
        pinterestPinId: pin.id,
        publishedUrl: canonicalUrl,
        publishedAt: new Date(),
        status: ArticleStatus.PUBLISHED,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    return { processed: 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const newRetryCount = article.retryCount + 1;

    await db
      .update(articles)
      .set({
        status: shouldRetry(newRetryCount)
          ? ArticleStatus.PIN_READY
          : ArticleStatus.FAILED,
        retryCount: newRetryCount,
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    throw error;
  }
}
