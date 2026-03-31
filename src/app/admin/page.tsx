"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PipelineRunStatus } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DashboardData {
  today: {
    articlesPublished: number;
    articlesCreated: number;
    pinsPosted: number;
    pinsPending: number;
    pinsFailed: number;
    pinsByType: {
      original: number;
      multiboard: number;
      recycled: number;
    };
  };
  allTime: {
    totalArticles: number;
    published: number;
    drafts: number;
    failed: number;
    keywords: number;
    totalPinsPosted: number;
  };
  inProgress: { status: string; value: number }[];
  recentRuns: {
    id: string;
    jobName: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    itemsProcessed: number;
    errorLog: string | null;
  }[];
  todayRunsSummary: {
    jobName: string;
    runs: number;
    processed: number;
    failures: number;
  }[];
}

const STATUS_LABELS: Record<string, string> = {
  content_generating: "Writing content",
  content_ready: "Content ready",
  image_generating: "Generating images",
  image_ready: "Images ready",
  pin_generating: "Creating pins",
  pin_ready: "Pins ready",
  publishing: "Publishing",
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d: DashboardData) => setData(d))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-red-500">Failed to load dashboard: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

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
                {data.today.articlesPublished}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Articles Created Today</CardDescription>
              <CardTitle className="text-3xl">
                {data.today.articlesCreated}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Pins Posted Today</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {data.today.pinsPosted}
              </CardTitle>
              {data.today.pinsPosted > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.today.pinsByType.original > 0 && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">
                      {data.today.pinsByType.original} original
                    </Badge>
                  )}
                  {data.today.pinsByType.multiboard > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {data.today.pinsByType.multiboard} multi-board
                    </Badge>
                  )}
                  {data.today.pinsByType.recycled > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {data.today.pinsByType.recycled} recycled
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Pins Queued</CardDescription>
              <CardTitle className="text-3xl text-amber-600">
                {data.today.pinsPending}
                {data.today.pinsFailed > 0 && (
                  <span className="ml-2 text-base text-red-500">
                    ({data.today.pinsFailed} failed)
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Link href="/admin/articles">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Total Articles</CardDescription>
                <CardTitle className="text-2xl">
                  {data.allTime.totalArticles}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/articles">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Published</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {data.allTime.published}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/articles">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Drafts</CardDescription>
                <CardTitle className="text-2xl">
                  {data.allTime.drafts}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/articles">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Failed</CardDescription>
                <CardTitle className="text-2xl text-red-600">
                  {data.allTime.failed}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/keywords">
            <Card size="sm" className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>Keywords</CardDescription>
                <CardTitle className="text-2xl">
                  {data.allTime.keywords}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Total Pins Posted</CardDescription>
              <CardTitle className="text-2xl text-blue-600">
                {data.allTime.totalPinsPosted}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Pipeline Status */}
      {data.inProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pipeline In Progress</CardTitle>
            <CardDescription>Articles currently being processed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {data.inProgress.map((row) => (
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
      {data.todayRunsSummary.length > 0 && (
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
                  {data.todayRunsSummary.map((row) => (
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
          {data.recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentRuns.map((run) => (
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
