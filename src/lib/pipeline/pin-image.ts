import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { ArticleStatus } from "@/lib/constants";
import { generatePinImage } from "@/lib/services/canva";
import { shouldRetry } from "@/lib/pipeline/base";
import { extractRecipeMeta } from "@/lib/utils/recipe-meta";
import { put } from "@vercel/blob";
import { eq, and, sql } from "drizzle-orm";

export async function createPinImage(): Promise<{ processed: number }> {
  const BATCH_SIZE = 10;
  let processed = 0;

  for (let i = 0; i < BATCH_SIZE; i++) {
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

    if (!article) break;

    try {
      if (!article.heroImageUrl) {
        throw new Error("No hero image URL found");
      }

      const meta = extractRecipeMeta(
        article.recipeJsonLd as Record<string, unknown> | null,
      );
      const pinParams = {
        title: article.title || "Delicious Recipe",
        heroImageUrl: article.heroImageUrl,
        heroImageUrl2: article.heroImageUrl2 ?? undefined,
        articleNumber: article.articleNumber,
        topIngredients: meta.topIngredients,
        servings: meta.servings,
        cookTime: meta.cookTime,
        eyebrow: meta.eyebrow,
        subtitle: meta.subtitle,
      };

      // D1 stacked: top photo / serif title / bottom photo / URL bar
      const pngBuffer = await generatePinImage(pinParams);

      const blob = await put(`recipes/${article.slug}/pin.png`, pngBuffer, {
        access: "public",
        allowOverwrite: true,
      });

      await db
        .update(articles)
        .set({
          pinImageUrl: blob.url,
          pinImageUrl2: blob.url,
          status: ArticleStatus.PIN_READY,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id));

      processed++;
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

      console.error(`[pin-image] Failed for ${article.slug}:`, message);
    }
  }

  return { processed };
}
