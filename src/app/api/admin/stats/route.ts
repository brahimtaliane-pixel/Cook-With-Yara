import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles, keywords, pipelineRuns, pinQueue } from "@/lib/db/schema";
import { desc, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Single query for all article stats + keyword count
  const [articleStats] = await db.select({
    total: sql<number>`count(*)::int`,
    published: sql<number>`count(*) filter (where ${articles.status} = 'published')::int`,
    drafts: sql<number>`count(*) filter (where ${articles.status} = 'draft')::int`,
    failed: sql<number>`count(*) filter (where ${articles.status} = 'failed')::int`,
    publishedToday: sql<number>`count(*) filter (where ${articles.status} = 'published' and ${articles.publishedAt} >= ${todayStart.toISOString()}::timestamp)::int`,
    createdToday: sql<number>`count(*) filter (where ${articles.createdAt} >= ${todayStart.toISOString()}::timestamp)::int`,
  }).from(articles);

  // Single query for all pin + keyword + in-progress stats
  const [[pinStats], [kwCount], inProgressRows] = await Promise.all([
    db.select({
      postedToday: sql<number>`count(*) filter (where ${pinQueue.status} = 'posted' and ${pinQueue.postedAt} >= ${todayStart.toISOString()}::timestamp)::int`,
      pending: sql<number>`count(*) filter (where ${pinQueue.status} = 'pending')::int`,
      failed: sql<number>`count(*) filter (where ${pinQueue.status} = 'failed')::int`,
      originalToday: sql<number>`count(*) filter (where ${pinQueue.status} = 'posted' and ${pinQueue.pinType} = 'original' and ${pinQueue.postedAt} >= ${todayStart.toISOString()}::timestamp)::int`,
      multiboardToday: sql<number>`count(*) filter (where ${pinQueue.status} = 'posted' and ${pinQueue.pinType} = 'multiboard' and ${pinQueue.postedAt} >= ${todayStart.toISOString()}::timestamp)::int`,
      recycledToday: sql<number>`count(*) filter (where ${pinQueue.status} = 'posted' and ${pinQueue.pinType} = 'recycled' and ${pinQueue.postedAt} >= ${todayStart.toISOString()}::timestamp)::int`,
      totalPostedAllTime: sql<number>`count(*) filter (where ${pinQueue.status} = 'posted')::int`,
    }).from(pinQueue),
    db.select({ value: sql<number>`count(*)::int` }).from(keywords),
    db.select({
      status: articles.status,
      value: sql<number>`count(*)::int`,
    }).from(articles).where(
      sql`${articles.status} IN ('content_generating', 'image_generating', 'pin_generating', 'publishing', 'content_ready', 'image_ready', 'pin_ready')`
    ).groupBy(articles.status),
  ]);

  // Pipeline runs - sequential to avoid connection pressure
  const recentRuns = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(10);

  const todayRunsSummary = await db.select({
    jobName: pipelineRuns.jobName,
    runs: sql<number>`count(*)::int`,
    processed: sql<number>`coalesce(sum(${pipelineRuns.itemsProcessed}), 0)::int`,
    failures: sql<number>`count(*) filter (where ${pipelineRuns.status} = 'failed')::int`,
  }).from(pipelineRuns)
    .where(gte(pipelineRuns.startedAt, todayStart))
    .groupBy(pipelineRuns.jobName);

  return NextResponse.json({
    today: {
      articlesPublished: articleStats.publishedToday,
      articlesCreated: articleStats.createdToday,
      pinsPosted: pinStats.postedToday,
      pinsPending: pinStats.pending,
      pinsFailed: pinStats.failed,
      pinsByType: {
        original: pinStats.originalToday,
        multiboard: pinStats.multiboardToday,
        recycled: pinStats.recycledToday,
      },
    },
    allTime: {
      totalArticles: articleStats.total,
      published: articleStats.published,
      drafts: articleStats.drafts,
      failed: articleStats.failed,
      keywords: kwCount.value,
      totalPinsPosted: pinStats.totalPostedAllTime,
    },
    inProgress: inProgressRows,
    recentRuns,
    todayRunsSummary,
  });
}
