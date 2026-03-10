import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { ArticleStatus } from "@/lib/constants";
import { generatePinImage } from "@/lib/services/canva";
import { shouldRetry } from "@/lib/pipeline/base";
import { put } from "@vercel/blob";
import { eq, and, sql } from "drizzle-orm";

export async function createPinImage(): Promise<{ processed: number }> {
  // Atomically claim one image_ready article
  const [article] = await db
    .update(articles)
    .set({ status: ArticleStatus.PIN_GENERATING, updatedAt: new Date() })
    .where(
      and(
        eq(articles.status, ArticleStatus.IMAGE_READY),
        sql`${articles.id} = (
          SELECT ${articles.id} FROM ${articles}
          WHERE ${articles.status} = ${ArticleStatus.IMAGE_READY}
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
    if (!article.heroImageUrl) {
      throw new Error("No hero image URL found");
    }

    // Generate pin image using Satori
    const pngBuffer = await generatePinImage({
      title: article.title || "Delicious Recipe",
      heroImageUrl: article.heroImageUrl,
    });

    // Upload to Vercel Blob
    const { url } = await put(
      `recipes/${article.slug}/pin.png`,
      pngBuffer,
      { access: "public" }
    );

    await db
      .update(articles)
      .set({
        pinImageUrl: url,
        status: ArticleStatus.PIN_READY,
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
          ? ArticleStatus.IMAGE_READY
          : ArticleStatus.FAILED,
        retryCount: newRetryCount,
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    throw error;
  }
}
