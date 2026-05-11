import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { ArticleStatus } from "@/lib/constants";
import { generateHeroImage } from "@/lib/services/nano-banana";
import { shouldRetry } from "@/lib/pipeline/base";
import { put } from "@vercel/blob";
import { eq, and, sql } from "drizzle-orm";

export async function submitImage(): Promise<{ processed: number }> {
  // Atomically claim one content_ready article
  const [article] = await db
    .update(articles)
    .set({ status: ArticleStatus.IMAGE_GENERATING, updatedAt: new Date() })
    .where(
      and(
        eq(articles.status, ArticleStatus.CONTENT_READY),
        sql`${articles.id} = (
          SELECT ${articles.id} FROM ${articles}
          WHERE ${articles.status} = ${ArticleStatus.CONTENT_READY}
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
    if (!article.midjourneyPrompt) {
      throw new Error("No image prompt found");
    }

    const image = await generateHeroImage(article.midjourneyPrompt);

    const extension = image.mimeType === "image/jpeg" ? "jpg" : "png";
    const { url } = await put(
      `recipes/${article.slug}/hero.${extension}`,
      image.data,
      { access: "public", contentType: image.mimeType }
    );

    await db
      .update(articles)
      .set({
        heroImageUrl: url,
        status: ArticleStatus.IMAGE_READY,
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
          ? ArticleStatus.CONTENT_READY
          : ArticleStatus.FAILED,
        retryCount: newRetryCount,
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    throw error;
  }
}
