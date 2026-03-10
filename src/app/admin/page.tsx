import Link from "next/link";
import { db } from "@/lib/db";
import { articles, keywords, pipelineRuns } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";
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
  const [
    [totalArticlesRow],
    [publishedRow],
    [failedArticlesRow],
    [totalKeywordsRow],
    [approvedKeywordsRow],
    recentRuns,
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
      .select()
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(5),
  ]);

  const stats = [
    { label: "Total Articles", value: totalArticlesRow?.value ?? 0, href: "/admin/articles" },
    { label: "Published", value: publishedRow?.value ?? 0, href: "/admin/articles?status=published" },
    { label: "Failed Articles", value: failedArticlesRow?.value ?? 0, href: "/admin/articles?status=failed" },
    { label: "Total Keywords", value: totalKeywordsRow?.value ?? 0, href: "/admin/keywords" },
    { label: "Approved Keywords", value: approvedKeywordsRow?.value ?? 0, href: "/admin/keywords" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-2xl">{s.value}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Pipeline Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="space-y-3">
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
