import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { ArticleStatus } from "@/lib/constants";
import { submitImagineJob, checkImagineJob } from "@/lib/services/imagineapi";
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
      throw new Error("No Midjourney prompt found");
    }

    // Sanitize prompt: replace words blocked by ImaginePro's content filter
    const sanitizedPrompt = article.midjourneyPrompt
      .replace(/\bbreast(s)?\b/gi, "fillet$1")
      .replace(/\bthigh(s)?\b/gi, "piece$1")
      .replace(/\bnaked\b/gi, "plain")
      .replace(/\bbare\b/gi, "simple");

    const taskId = await submitImagineJob(sanitizedPrompt);

    await db
      .update(articles)
      .set({
        midjourneyTaskId: taskId,
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

export async function pollImages(): Promise<{ processed: number }> {
  const pendingArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.status, ArticleStatus.IMAGE_GENERATING))
    .limit(20);

  let processed = 0;

  for (const article of pendingArticles) {
    if (!article.midjourneyTaskId) continue;

    try {
      const result = await checkImagineJob(article.midjourneyTaskId);

      if (result.status === "completed" && result.result) {
        // Download the image
        const imageResponse = await fetch(result.result);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }

        const imageBlob = await imageResponse.blob();

        // Upload to Vercel Blob
        const { url } = await put(
          `recipes/${article.slug}/hero.jpg`,
          imageBlob,
          { access: "public" }
        );

        await db
          .update(articles)
          .set({
            heroImageUrl: url,
            status: ArticleStatus.IMAGE_READY,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, article.id));

        processed++;
      } else if (result.status === "failed") {
        const newRetryCount = article.retryCount + 1;
        await db
          .update(articles)
          .set({
            status: shouldRetry(newRetryCount)
              ? ArticleStatus.CONTENT_READY
              : ArticleStatus.FAILED,
            retryCount: newRetryCount,
            failureReason: "Image generation failed",
            updatedAt: new Date(),
          })
          .where(eq(articles.id, article.id));
      }
      // If still pending, do nothing — will check again next poll
    } catch (error) {
      console.error(
        `Failed to poll image for article ${article.id}:`,
        error
      );
    }
  }

  return { processed };
}
