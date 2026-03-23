import Link from "next/link";
import { db } from "@/lib/db";
import { articles, keywords, pipelineRuns, pinQueue } from "@/lib/db/schema";
import { eq, count, desc, gte, and, sql } from "drizzle-orm";
import { ArticleStatus, KeywordStatus, PipelineRunStatus } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    // All-time counts
    [totalArticlesRow],
    [publishedRow],
    [draftRow],
    [failedArticlesRow],
    [totalKeywordsRow],
    // Today counts
    [articlesPublishedTodayRow],
    [articlesCreatedTodayRow],
    [pinsPostedTodayRow],
    [pinsPendingRow],
    [pinsFailedRow],
    // Pipeline in-progress
    inProgressRows,
    // Recent runs
    recentRuns,
    // Today's pipeline runs summary
    todayRunsSummary,
  ] = await Promise.all([
    // All-time
    db.select({ value: count() }).from(articles),
    db.select({ value: count() }).from(articles).where(eq(articles.status, ArticleStatus.PUBLISHED)),
    db.select({ value: count() }).from(articles).where(eq(articles.status, ArticleStatus.DRAFT)),
    db.select({ value: count() }).from(articles).where(eq(articles.status, ArticleStatus.FAILED)),
    db.select({ value: count() }).from(keywords),
    // Today
    db.select({ value: count() }).from(articles).where(
      and(eq(articles.status, ArticleStatus.PUBLISHED), gte(articles.publishedAt, todayStart))
    ),
    db.select({ value: count() }).from(articles).where(gte(articles.createdAt, todayStart)),
    db.select({ value: count() }).from(pinQueue).where(
      and(eq(pinQueue.status, "posted"), gte(pinQueue.postedAt, todayStart))
    ),
    db.select({ value: count() }).from(pinQueue).where(eq(pinQueue.status, "pending")),
    db.select({ value: count() }).from(pinQueue).where(eq(pinQueue.status, "failed")),
    // In-progress articles (stuck detection)
    db
      .select({ status: articles.status, value: sql<number>`count(*)::int` })
      .from(articles)
      .where(
        sql`${articles.status} IN ('content_generating', 'image_generating', 'pin_generating', 'publishing', 'content_ready', 'image_ready', 'pin_ready')`
      )
      .groupBy(articles.status),
    // Recent pipeline runs
    db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(10),
    // Today's pipeline run stats
    db
      .select({
        jobName: pipelineRuns.jobName,
        runs: sql<number>`count(*)::int`,
        processed: sql<number>`coalesce(sum(${pipelineRuns.itemsProcessed}), 0)::int`,
        failures: sql<number>`count(*) filter (where ${pipelineRuns.status} = 'failed')::int`,
      })
      .from(pipelineRuns)
      .where(gte(pipelineRuns.startedAt, todayStart))
      .groupBy(pipelineRuns.jobName),
  ]);

  const STATUS_LABELS: Record<string, string> = {
    content_generating: "Writing content",
    content_ready: "Content ready",
    image_generating: "Generating images",
    image_ready: "Images ready",
    pin_generating: "Creating pins",
    pin_ready: "Pins ready",
    publishing: "Publishing",
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Today's Stats */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Today
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Articles Published Today</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {articlesPublishedTodayRow?.value ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Articles Created Today</CardDescription>
              <CardTitle className="text-3xl">
                {articlesCreatedTodayRow?.value ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Pins Posted Today</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {pinsPostedTodayRow?.value ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Pins Queued</CardDescription>
              <CardTitle className="text-3xl text-amber-600">
                {pinsPendingRow?.value ?? 0}
                {(pinsFailedRow?.value ?? 0) > 0 && (
                  <span className="ml-2 text-base text-red-500">
                    ({pinsFailedRow?.value} failed)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* All-time Stats */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          All Time
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link href="/admin/articles">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Total Articles</CardDescription>
                <CardTitle className="text-2xl">
                  {totalArticlesRow?.value ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/articles">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Published</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {publishedRow?.value ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/articles">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Drafts</CardDescription>
                <CardTitle className="text-2xl">
                  {draftRow?.value ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/articles">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Failed</CardDescription>
                <CardTitle className="text-2xl text-red-600">
                  {failedArticlesRow?.value ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/keywords">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Keywords</CardDescription>
                <CardTitle className="text-2xl">
                  {totalKeywordsRow?.value ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>

      {/* Pipeline Status */}
      {inProgressRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pipeline In Progress</CardTitle>
            <CardDescription>Articles currently being processed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {inProgressRows.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {STATUS_LABELS[row.status] || row.status}
                  </span>
                  <Badge variant="secondary">{row.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Pipeline Activity */}
      {todayRunsSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Pipeline Activity</CardTitle>
            <CardDescription>Cron job runs and items processed today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Job</th>
                    <th className="px-4 py-2 text-right font-medium">Runs</th>
                    <th className="px-4 py-2 text-right font-medium">Processed</th>
                    <th className="px-4 py-2 text-right font-medium">Failures</th>
                  </tr>
                </thead>
                <tbody>
                  {todayRunsSummary.map((row) => (
                    <tr key={row.jobName} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{row.jobName}</td>
                      <td className="px-4 py-2 text-right">{row.runs}</td>
                      <td className="px-4 py-2 text-right text-green-600">{row.processed}</td>
                      <td className="px-4 py-2 text-right">
                        {row.failures > 0 ? (
                          <span className="text-red-600">{row.failures}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Pipeline Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Pipeline Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{run.jobName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {run.itemsProcessed} items
                    </span>
                    <Badge
                      variant={
                        run.status === PipelineRunStatus.COMPLETED
                          ? "default"
                          : run.status === PipelineRunStatus.RUNNING
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
