import { db } from "@/lib/db";
import { articles, pinQueue, keywords } from "@/lib/db/schema";
import { ArticleStatus, ConfigKeys } from "@/lib/constants";
import { getCanonicalUrl } from "@/lib/utils/seo";
import { shouldRetry, getConfigValue } from "@/lib/pipeline/base";
import { getBoardForArticle, getBoardsForArticle } from "@/lib/services/pinterest-boards";
import { getNextPostingSlot } from "@/lib/pipeline/schedule";
import { generatePinterestCopy } from "@/lib/services/pinterest-copy";
import { eq, and, sql } from "drizzle-orm";

export async function publishAndPin(): Promise<{ processed: number }> {
  const BATCH_SIZE = 5;
  let processed = 0;

  for (let i = 0; i < BATCH_SIZE; i++) {
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

    if (!article) break;

    try {
      const canonicalUrl = getCanonicalUrl(article.slug);

      // Trigger ISR revalidation
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithlucia.com";
      await fetch(`${siteUrl}/api/revalidate?slug=${article.slug}&secret=${process.env.CRON_SECRET}`);

      // Get recipe metadata
      const recipeJsonLd = article.recipeJsonLd as Record<string, unknown> | null;
      const recipeCategory = (recipeJsonLd?.recipeCategory as string) ?? "";
      const topIngredients = Array.isArray(recipeJsonLd?.recipeIngredient)
        ? (recipeJsonLd.recipeIngredient as string[]).slice(0, 6)
        : [];

      // Look up the keyword for this article
      let keywordText = "";
      if (article.keywordId) {
        const [kw] = await db
          .select({ keyword: keywords.keyword })
          .from(keywords)
          .where(eq(keywords.id, article.keywordId))
          .limit(1);
        keywordText = kw?.keyword ?? "";
      }

      // Generate Pinterest-optimized copy
      let pinTitle = article.title || "Delicious Recipe";
      let pinDescription = article.metaDescription || "";
      let altText: string | undefined;

      try {
        const copy = await generatePinterestCopy({
          title: article.title || "",
          metaDescription: article.metaDescription || "",
          keyword: keywordText,
          recipeCategory,
          topIngredients,
        });
        pinTitle = copy.pinterestTitle;
        pinDescription = copy.pinterestDescription;
        altText = copy.altText;
      } catch (err) {
        console.error("[publish] Pinterest copy generation failed, using SEO defaults:", err);
      }

      // Determine target Pinterest board(s)
      const primaryBoardId = await getBoardForArticle(article.title, recipeCategory);

      // Queue both pin designs for scheduled posting at optimal times
      const slot1 = await getNextPostingSlot();
      let lastSlot = slot1;

      if (article.pinImageUrl) {
        await db.insert(pinQueue).values({
          articleId: article.id,
          imageUrl: article.pinImageUrl,
          pinDesign: 1,
          title: pinTitle,
          description: pinDescription,
          link: canonicalUrl,
          boardId: primaryBoardId,
          altText,
          pinType: "original",
          scheduledAt: slot1,
        });
      }
      if (article.pinImageUrl2) {
        const slot2 = await getNextPostingSlot({ afterSlot: slot1 });
        lastSlot = slot2;
        await db.insert(pinQueue).values({
          articleId: article.id,
          imageUrl: article.pinImageUrl2,
          pinDesign: 2,
          title: pinTitle,
          description: pinDescription,
          link: canonicalUrl,
          boardId: primaryBoardId,
          altText,
          pinType: "original",
          scheduledAt: slot2,
        });
      }

      // Multi-board distribution
      const multiBoardEnabled = (await getConfigValue(ConfigKeys.MULTI_BOARD_ENABLED, "true")) === "true";
      if (multiBoardEnabled) {
        const allBoards = await getBoardsForArticle(article.title, recipeCategory, 3);
        const secondaryBoards = allBoards.filter((id) => id !== primaryBoardId);

        for (let j = 0; j < secondaryBoards.length; j++) {
          const daysAfter = j + 2; // 2 days for first secondary, 3 for second
          const afterDate = new Date(lastSlot.getTime() + daysAfter * 24 * 60 * 60 * 1000);
          const secondarySlot = await getNextPostingSlot({ afterSlot: afterDate });

          // Queue design 1 to secondary board
          if (article.pinImageUrl) {
            await db.insert(pinQueue).values({
              articleId: article.id,
              imageUrl: article.pinImageUrl,
              pinDesign: 1,
              title: pinTitle,
              description: pinDescription,
              link: canonicalUrl,
              boardId: secondaryBoards[j],
              altText,
              pinType: "multiboard",
              scheduledAt: secondarySlot,
            });
          }
        }
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

      processed++;
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

      console.error(`[publish] Failed for ${article.slug}:`, message);
    }
  }

  return { processed };
}
