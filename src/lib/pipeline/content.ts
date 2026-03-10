import { db } from "@/lib/db";
import { articles, keywords } from "@/lib/db/schema";
import { ArticleStatus, KeywordStatus, PIPELINE_DEFAULTS } from "@/lib/constants";
import { generateArticleContent } from "@/lib/services/ai-writer";
import { shouldRetry } from "@/lib/pipeline/base";
import { eq, and, sql } from "drizzle-orm";

export async function generateContent(): Promise<{ processed: number }> {
  // Atomically claim one draft article
  const [article] = await db
    .update(articles)
    .set({ status: ArticleStatus.CONTENT_GENERATING, updatedAt: new Date() })
    .where(
      and(
        eq(articles.status, ArticleStatus.DRAFT),
        sql`${articles.id} = (
          SELECT ${articles.id} FROM ${articles}
          WHERE ${articles.status} = ${ArticleStatus.DRAFT}
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
    // Get the keyword text
    const [keyword] = await db
      .select()
      .from(keywords)
      .where(eq(keywords.id, article.keywordId))
      .limit(1);

    if (!keyword) {
      throw new Error(`Keyword not found for article ${article.id}`);
    }

    const content = await generateArticleContent(keyword.keyword);

    await db
      .update(articles)
      .set({
        title: content.title,
        metaDescription: content.metaDescription,
        contentMdx: content.contentMdx,
        recipeJsonLd: content.recipeJsonLd,
        midjourneyPrompt: content.midjourneyPrompt,
        status: ArticleStatus.CONTENT_READY,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    // Mark keyword as completed
    await db
      .update(keywords)
      .set({ status: KeywordStatus.COMPLETED, updatedAt: new Date() })
      .where(eq(keywords.id, keyword.id));

    return { processed: 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const newRetryCount = article.retryCount + 1;

    await db
      .update(articles)
      .set({
        status: shouldRetry(newRetryCount)
          ? ArticleStatus.DRAFT
          : ArticleStatus.FAILED,
        retryCount: newRetryCount,
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    throw error;
  }
}
