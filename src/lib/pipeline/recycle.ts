import { db } from "@/lib/db";
import { articles, pinQueue, keywords } from "@/lib/db/schema";
import { ArticleStatus, ConfigKeys } from "@/lib/constants";
import { getConfigValue } from "@/lib/pipeline/base";
import { getCanonicalUrl } from "@/lib/utils/seo";
import { generatePinDesign } from "@/lib/services/canva";
import { generatePinterestCopy } from "@/lib/services/pinterest-copy";
import { getBoardsForArticle } from "@/lib/services/pinterest-boards";
import { getNextPostingSlot } from "@/lib/pipeline/schedule";
import { extractRecipeMeta } from "@/lib/utils/recipe-meta";
import { put } from "@vercel/blob";
import { eq, and, sql, asc } from "drizzle-orm";

const MAX_CANDIDATES_PER_RUN = 3;
const AVAILABLE_DESIGNS = [7]; // D7 full-bleed hero — the single active pin design

export async function recyclePins(): Promise<{ processed: number }> {
  const enabled = (await getConfigValue(ConfigKeys.RECYCLE_ENABLED, "false")) === "true";
  if (!enabled) {
    console.log("[recycle] Recycling disabled");
    return { processed: 0 };
  }

  const maxPerDay = parseInt(
    await getConfigValue(ConfigKeys.MAX_RECYCLED_PINS_PER_DAY, "10"),
    10
  );
  const maxPerArticle = parseInt(
    await getConfigValue(ConfigKeys.MAX_RECYCLES_PER_ARTICLE, "5"),
    10
  );
  const cooldownDays = parseInt(
    await getConfigValue(ConfigKeys.RECYCLE_COOLDOWN_DAYS, "30"),
    10
  );

  // Check daily budget
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: recycledToday }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pinQueue)
    .where(
      and(
        eq(pinQueue.pinType, "recycled"),
        eq(pinQueue.status, "pending"),
        sql`${pinQueue.createdAt} >= ${todayStart.toISOString()}`
      )
    );

  const remainingBudget = maxPerDay - recycledToday;
  if (remainingBudget <= 0) {
    console.log("[recycle] Daily recycled pin budget exhausted");
    return { processed: 0 };
  }

  // Find eligible articles
  const cooldownDate = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.status, ArticleStatus.PUBLISHED),
        sql`${articles.recycleCount} < ${maxPerArticle}`,
        sql`(${articles.lastRecycledAt} IS NULL OR ${articles.lastRecycledAt} <= ${cooldownDate.toISOString()})`
      )
    )
    .orderBy(asc(articles.recycleCount), asc(articles.lastRecycledAt))
    .limit(Math.min(MAX_CANDIDATES_PER_RUN, remainingBudget));

  if (candidates.length === 0) {
    console.log("[recycle] No eligible articles for recycling");
    return { processed: 0 };
  }

  let processed = 0;

  for (const article of candidates) {
    try {
      if (!article.heroImageUrl) continue;

      // Find which designs have been used for this article
      const existingDesigns = await db
        .select({ pinDesign: pinQueue.pinDesign })
        .from(pinQueue)
        .where(eq(pinQueue.articleId, article.id));

      const usedDesigns = new Set(existingDesigns.map((d) => d.pinDesign));

      // Pick a design not yet used
      let designNum = AVAILABLE_DESIGNS.find((d) => !usedDesigns.has(d));
      if (!designNum) {
        // All designs used — cycle through again
        designNum = AVAILABLE_DESIGNS[article.recycleCount % AVAILABLE_DESIGNS.length];
      }

      // Get recipe metadata
      const recipeJsonLd = article.recipeJsonLd as Record<string, unknown> | null;
      const meta = extractRecipeMeta(recipeJsonLd);
      const { recipeCategory, topIngredients, servings, cookTime } = meta;

      // Generate new pin image with the chosen design
      const pinBuffer = await generatePinDesign(designNum, {
        title: article.title || "Delicious Recipe",
        heroImageUrl: article.heroImageUrl,
        articleNumber: article.articleNumber,
        topIngredients,
        servings,
        cookTime,
      });

      // Upload to Vercel Blob
      const blob = await put(
        `recipes/${article.slug}/pin-recycled-${designNum}-${Date.now()}.png`,
        pinBuffer,
        { access: "public" }
      );

      // Look up keyword
      let keywordText = "";
      if (article.keywordId) {
        const [kw] = await db
          .select({ keyword: keywords.keyword })
          .from(keywords)
          .where(eq(keywords.id, article.keywordId))
          .limit(1);
        keywordText = kw?.keyword ?? "";
      }

      // Generate new Pinterest copy with different keyword angle
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
          isRecycled: true,
        });
        pinTitle = copy.pinterestTitle;
        pinDescription = copy.pinterestDescription;
        altText = copy.altText;
      } catch (err) {
        console.error("[recycle] Pinterest copy generation failed:", err);
      }

      // Pick a board not yet used for this article
      const allBoards = await getBoardsForArticle(article.title, recipeCategory, 3);
      const existingBoards = await db
        .select({ boardId: pinQueue.boardId })
        .from(pinQueue)
        .where(eq(pinQueue.articleId, article.id));

      const usedBoardIds = new Set(existingBoards.map((b) => b.boardId).filter(Boolean));
      const boardId = allBoards.find((id) => !usedBoardIds.has(id)) ?? allBoards[0] ?? "";

      // Queue the recycled pin
      const canonicalUrl = article.publishedUrl || getCanonicalUrl(article.slug);
      const slot = await getNextPostingSlot();

      await db.insert(pinQueue).values({
        articleId: article.id,
        imageUrl: blob.url,
        pinDesign: designNum,
        title: pinTitle,
        description: pinDescription,
        link: canonicalUrl,
        boardId,
        altText,
        pinType: "recycled",
        scheduledAt: slot,
      });

      // Update article recycle tracking
      await db
        .update(articles)
        .set({
          recycleCount: article.recycleCount + 1,
          lastRecycledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id));

      processed++;
      console.log(
        `[recycle] Queued recycled pin for "${article.title}" (design ${designNum}, board ${boardId})`
      );
    } catch (err) {
      console.error(`[recycle] Failed to recycle article ${article.id}:`, err);
    }
  }

  return { processed };
}
