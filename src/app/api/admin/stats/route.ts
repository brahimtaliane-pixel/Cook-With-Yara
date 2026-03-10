import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles, keywords, pipelineRuns } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { ArticleStatus, KeywordStatus, PipelineRunStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    [totalArticles],
    [publishedArticles],
    [failedArticles],
    [totalKeywords],
    [approvedKeywords],
    [failedKeywords],
    lastRun,
  ] = await Promise.all([
    db.select({ value: count() }).from(articles),
    db
      .select({ value: count() })
      .from(articles)
      .where(eq(articles.status, ArticleStatus.PUBLISHED)),
    db
      .select({ value: count() })
      .from(articles)
      .where(eq(articles.status, ArticleStatus.FAILED)),
    db.select({ value: count() }).from(keywords),
    db
      .select({ value: count() })
      .from(keywords)
      .where(eq(keywords.status, KeywordStatus.APPROVED)),
    db
      .select({ value: count() })
      .from(keywords)
      .where(eq(keywords.status, KeywordStatus.FAILED)),
    db
      .select()
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(1),
  ]);

  return NextResponse.json({
    articles: {
      total: totalArticles?.value ?? 0,
      published: publishedArticles?.value ?? 0,
      failed: failedArticles?.value ?? 0,
    },
    keywords: {
      total: totalKeywords?.value ?? 0,
      approved: approvedKeywords?.value ?? 0,
      failed: failedKeywords?.value ?? 0,
    },
    lastPipelineRun: lastRun[0] ?? null,
  });
}
