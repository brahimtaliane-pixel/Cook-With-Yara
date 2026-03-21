import { db } from "@/lib/db";
import { articles, pinQueue } from "@/lib/db/schema";
import { ArticleStatus } from "@/lib/constants";
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

    // Queue both pin designs for scheduled posting
    if (article.pinImageUrl) {
      await db.insert(pinQueue).values({
        articleId: article.id,
        imageUrl: article.pinImageUrl,
        pinDesign: 1,
        title: article.title || "Delicious Recipe",
        description: article.metaDescription || "",
        link: canonicalUrl,
      });
    }
    if (article.pinImageUrl2) {
      await db.insert(pinQueue).values({
        articleId: article.id,
        imageUrl: article.pinImageUrl2,
        pinDesign: 2,
        title: article.title || "Delicious Recipe",
        description: article.metaDescription || "",
        link: canonicalUrl,
      });
    }

    await db
      .update(articles)
      .set({
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
