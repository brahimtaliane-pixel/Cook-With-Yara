import { db } from "@/lib/db";
import { keywords, articles } from "@/lib/db/schema";
import { KeywordStatus, ArticleStatus, ConfigKeys, PIPELINE_DEFAULTS } from "@/lib/constants";
import { evaluateKeyword } from "@/lib/services/ai-writer";
import { getConfigValue } from "@/lib/pipeline/base";
import { generateSlug } from "@/lib/utils/slug";
import { eq, desc, sql } from "drizzle-orm";

export async function approveKeywords(): Promise<{ processed: number }> {
  const maxPerDay = parseInt(
    await getConfigValue(
      ConfigKeys.MAX_ARTICLES_PER_DAY,
      String(PIPELINE_DEFAULTS.MAX_ARTICLES_PER_DAY)
    )
  );

  // Count articles created today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(sql`${articles.createdAt} >= ${todayStart.toISOString()}`);

  const remaining = maxPerDay - (todayCount?.count ?? 0);
  if (remaining <= 0) {
    return { processed: 0 };
  }

  // Get top keywords by trend score — fetch extra to account for duplicates/rejections
  const pendingKeywords = await db
    .select()
    .from(keywords)
    .where(eq(keywords.status, KeywordStatus.NEW))
    .orderBy(desc(keywords.pinterestTrendScore))
    .limit(remaining * 3);

  let processed = 0;
  let approved = 0;

  for (const kw of pendingKeywords) {
    // Stop once we've approved enough for today
    if (approved >= remaining) break;

    try {
      // Check for slug collision before calling Claude
      const slug = generateSlug(kw.keyword);
      const [existingArticle] = await db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.slug, slug))
        .limit(1);

      if (existingArticle) {
        // Slug already exists — reject as duplicate
        await db
          .update(keywords)
          .set({
            status: KeywordStatus.REJECTED,
            failureReason: `Duplicate: article with slug "${slug}" already exists`,
            updatedAt: new Date(),
          })
          .where(eq(keywords.id, kw.id));
        processed++;
        continue;
      }

      const evaluation = await evaluateKeyword(kw.keyword);

      if (evaluation.approved) {
        // Approve keyword
        await db
          .update(keywords)
          .set({ status: KeywordStatus.APPROVED, updatedAt: new Date() })
          .where(eq(keywords.id, kw.id));

        // Create article stub
        await db
          .insert(articles)
          .values({
            keywordId: kw.id,
            slug,
            status: ArticleStatus.DRAFT,
          })
          .onConflictDoNothing({ target: articles.slug });

        approved++;
      } else {
        await db
          .update(keywords)
          .set({
            status: KeywordStatus.REJECTED,
            failureReason: evaluation.reason,
            updatedAt: new Date(),
          })
          .where(eq(keywords.id, kw.id));
      }

      processed++;
    } catch (error) {
      console.error(`Failed to evaluate keyword "${kw.keyword}":`, error);
    }
  }

  return { processed };
}
