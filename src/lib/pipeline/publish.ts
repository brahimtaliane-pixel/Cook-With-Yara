import { db } from "@/lib/db";
import { articles, pinQueue, keywords } from "@/lib/db/schema";
import { ArticleStatus, ConfigKeys, PinType } from "@/lib/constants";
import { getCanonicalUrl } from "@/lib/utils/seo";
import { shouldRetry, getConfigValue } from "@/lib/pipeline/base";
import { getBoardForArticle } from "@/lib/services/pinterest-boards";
import { getNextPostingSlot } from "@/lib/pipeline/schedule";
import { generatePinterestCopy } from "@/lib/services/pinterest-copy";
import { eq, and, sql, gte } from "drizzle-orm";

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
            ORDER BY ${articles.createdAt} DESC
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
        process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithyara.com";
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

      // Determine target Pinterest board
      const primaryBoardId = await getBoardForArticle(article.title, recipeCategory);

      // Daily pin budget: a fixed number of linked + no-link image pins per day,
      // newest recipes first (this is the newest PIN_READY article). Once the
      // day's budget is used, further recipes still publish for SEO but aren't
      // pinned — so the queue stays lean and there's no backlog.
      const maxLinked = parseInt(
        await getConfigValue(ConfigKeys.MAX_LINKED_PINS_PER_DAY, "3"),
        10,
      );
      const maxNolink = parseInt(
        await getConfigValue(ConfigKeys.MAX_NOLINK_PINS_PER_DAY, "2"),
        10,
      );
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);

      const [{ count: linkedToday }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(pinQueue)
        .where(
          and(eq(pinQueue.pinType, PinType.ORIGINAL), gte(pinQueue.createdAt, dayStart)),
        );
      const [{ count: nolinkToday }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(pinQueue)
        .where(
          and(eq(pinQueue.pinType, PinType.NOLINK), gte(pinQueue.createdAt, dayStart)),
        );

      // Spend the linked budget first, then the no-link budget.
      let pinType: string | null = null;
      let pinLink = "";
      if (linkedToday < maxLinked) {
        pinType = PinType.ORIGINAL;
        pinLink = canonicalUrl;
      } else if (nolinkToday < maxNolink) {
        pinType = PinType.NOLINK;
        pinLink = ""; // no destination — image-only pin
      }

      if (pinType && article.pinImageUrl) {
        const slot1 = await getNextPostingSlot();
        await db.insert(pinQueue).values({
          articleId: article.id,
          imageUrl: article.pinImageUrl,
          pinDesign: 7,
          title: pinTitle,
          description: pinDescription,
          link: pinLink,
          boardId: primaryBoardId,
          altText,
          pinType,
          scheduledAt: slot1,
        });
        console.log(`[publish] Queued ${pinType} pin for "${article.slug}"`);
      } else {
        console.log(
          `[publish] Daily pin budget reached — published "${article.slug}" without a pin`,
        );
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
