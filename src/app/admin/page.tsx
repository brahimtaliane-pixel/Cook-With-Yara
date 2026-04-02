"use client";

import Link from "next/link";
import Image from "next/image";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ImageIcon,
  Calendar,
} from "lucide-react";

// ---------- Types ----------

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

interface PinRow {
  id: string;
  title: string;
  imageUrl: string;
  pinType: string;
  boardId: string | null;
  postedAt: string | null;
  scheduledAt: string | null;
  pinterestPinId: string | null;
  link: string;
  pinDesign: number;
  status: string;
  failureReason: string | null;
  altText: string | null;
  retryCount: number;
}

interface PinDashboardData {
  todayPins: PinRow[];
  yesterdayPins: PinRow[];
  upcomingPins: PinRow[];
  failedPins: PinRow[];
  hourlyBreakdown: { hour: number; count: number }[];
  dailyTarget: number;
}

// ---------- Helpers ----------

const STATUS_LABELS: Record<string, string> = {
  content_generating: "Writing content",
  content_ready: "Content ready",
  image_generating: "Generating images",
  image_ready: "Images ready",
  pin_generating: "Creating pins",
  pin_ready: "Pins ready",
  publishing: "Publishing",
};

const PIN_TYPE_STYLES: Record<string, { label: string; color: string; barColor: string }> = {
  original: { label: "Original", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", barColor: "bg-blue-500" },
  multiboard: { label: "Multi-board", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", barColor: "bg-purple-500" },
  recycled: { label: "Recycled", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", barColor: "bg-amber-500" },
};

function formatRelativeTime(dateStr: string): string {
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs < 0) return "overdue";

  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return remainMins > 0 ? `in ${hours}h ${remainMins}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

function formatHour(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

// ---------- Sub-components ----------

function PinTypeBadge({ type }: { type: string }) {
  const style = PIN_TYPE_STYLES[type] || PIN_TYPE_STYLES.original;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.color}`}>
      {style.label}
    </span>
  );
}

function PinListItem({ pin, showTime }: { pin: PinRow; showTime: "posted" | "scheduled" | "failed" }) {
  const timeStr = showTime === "posted" && pin.postedAt
    ? formatTime(pin.postedAt)
    : showTime === "scheduled" && pin.scheduledAt
      ? formatRelativeTime(pin.scheduledAt)
      : null;

  return (
    <div className="flex items-center gap-3 border-b border-border/50 px-3 py-2 last:border-0 hover:bg-muted/30 transition-colors">
      {/* Thumbnail */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {pin.imageUrl ? (
          <Image
            src={pin.imageUrl}
            alt={pin.altText || pin.title}
            fill
            className="object-cover"
            sizes="40px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Title + Board + Time */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{pin.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {pin.boardId && <span className="truncate max-w-[120px]">{pin.boardId}</span>}
          {timeStr && (
            <>
              {pin.boardId && <span>·</span>}
              <span className={showTime === "scheduled" ? "text-blue-600 dark:text-blue-400" : ""}>
                {timeStr}
              </span>
            </>
          )}
          {showTime === "failed" && pin.failureReason && (
            <span className="truncate text-red-500" title={pin.failureReason}>
              {pin.failureReason}
            </span>
          )}
        </div>
      </div>

      {/* Right side: badge + link */}
      <div className="flex shrink-0 items-center gap-2">
        <PinTypeBadge type={pin.pinType} />
        {pin.pinterestPinId && (
          <a
            href={`https://www.pinterest.com/pin/${pin.pinterestPinId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="View on Pinterest"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {showTime === "failed" && (
          <span className="text-[10px] text-red-500 font-medium" title="Retry count">
            ×{pin.retryCount}
          </span>
        )}
      </div>
    </div>
  );
}

function HourlyChart({ data, dailyTarget }: { data: { hour: number; count: number }[]; dailyTarget: number }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalPosted = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>Hourly Activity (EST)</CardDescription>
        <CardTitle className="text-sm font-medium">
          {totalPosted} pins today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[3px]" style={{ height: 64 }}>
          {data.map((d) => {
            const barH = d.count > 0 ? Math.max(Math.round((d.count / maxCount) * 56), 6) : 3;
            return (
              <div key={d.hour} className="flex-1 group relative h-full flex items-end">
                <div
                  className={`w-full rounded-sm transition-all ${d.count > 0 ? "bg-blue-500 dark:bg-blue-400" : "bg-muted"}`}
                  style={{ height: barH }}
                />
                {d.count > 0 && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                    {d.count} @ {formatHour(d.hour)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>11p</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Main Page ----------

export default function AdminOverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [pinData, setPinData] = useState<PinDashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => {
        if (!r.ok) throw new Error(`Stats: ${r.status}`);
        return r.json();
      }),
      fetch("/api/admin/dashboard/pins").then((r) => {
        if (!r.ok) throw new Error(`Pins: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([statsData, pinsData]: [DashboardData, PinDashboardData]) => {
        setData(statsData);
        setPinData(pinsData);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-red-500">Failed to load dashboard: {error}</p>
      </div>
    );
  }

  if (!data || !pinData) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const progressPct = Math.min((data.today.pinsPosted / pinData.dailyTarget) * 100, 100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* ===== Section A: Top Stats Bar ===== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Daily Progress */}
        <Card size="sm">
          <CardHeader>
            <CardDescription>Daily Progress</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {data.today.pinsPosted}
              <span className="text-lg text-muted-foreground font-normal">/{pinData.dailyTarget}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {data.today.pinsPosted > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {data.today.pinsByType.original > 0 && (
                  <PinTypeBadge type="original" />
                )}
                {data.today.pinsByType.multiboard > 0 && (
                  <PinTypeBadge type="multiboard" />
                )}
                {data.today.pinsByType.recycled > 0 && (
                  <PinTypeBadge type="recycled" />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Articles Today */}
        <Card size="sm">
          <CardHeader>
            <CardDescription>Articles Today</CardDescription>
            <div className="flex items-baseline gap-3">
              <div>
                <CardTitle className="text-3xl text-green-600">
                  {data.today.articlesPublished}
                </CardTitle>
                <span className="text-xs text-muted-foreground">published</span>
              </div>
              <div>
                <CardTitle className="text-3xl">
                  {data.today.articlesCreated}
                </CardTitle>
                <span className="text-xs text-muted-foreground">created</span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Queue */}
        <Card size="sm">
          <CardHeader>
            <CardDescription>Queue</CardDescription>
            <div className="flex items-baseline gap-3">
              <div>
                <CardTitle className="text-3xl text-amber-600">
                  {data.today.pinsPending}
                </CardTitle>
                <span className="text-xs text-muted-foreground">pending</span>
              </div>
              {data.today.pinsFailed > 0 && (
                <div>
                  <CardTitle className="text-3xl text-red-500">
                    {data.today.pinsFailed}
                  </CardTitle>
                  <span className="text-xs text-red-500">failed</span>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* All-Time Pins */}
        <Card size="sm">
          <CardHeader>
            <CardDescription>All-Time Pins</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {data.allTime.totalPinsPosted.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* ===== Section B: Hourly Activity Chart ===== */}
      <HourlyChart data={pinData.hourlyBreakdown} dailyTarget={pinData.dailyTarget} />

      {/* ===== Section C: Pin Activity Tabs ===== */}
      <Tabs defaultValue={0}>
        <TabsList>
          <TabsTrigger value={0}>
            <CheckCircle className="h-3.5 w-3.5" />
            Today ({pinData.todayPins.length})
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Calendar className="h-3.5 w-3.5" />
            Yesterday ({pinData.yesterdayPins.length})
          </TabsTrigger>
          <TabsTrigger value={2}>
            <Clock className="h-3.5 w-3.5" />
            Upcoming ({pinData.upcomingPins.length})
          </TabsTrigger>
          <TabsTrigger value={3}>
            <AlertCircle className="h-3.5 w-3.5" />
            Failed ({pinData.failedPins.length})
          </TabsTrigger>
        </TabsList>

        {/* Today */}
        <TabsContent value={0}>
          <Card>
            <CardContent className="p-0">
              {pinData.todayPins.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No pins posted today yet.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {pinData.todayPins.map((pin) => (
                    <PinListItem key={pin.id} pin={pin} showTime="posted" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Yesterday */}
        <TabsContent value={1}>
          <Card>
            <CardContent className="p-0">
              {pinData.yesterdayPins.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No pins posted yesterday.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {pinData.yesterdayPins.map((pin) => (
                    <PinListItem key={pin.id} pin={pin} showTime="posted" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upcoming */}
        <TabsContent value={2}>
          <Card>
            <CardContent className="p-0">
              {pinData.upcomingPins.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No upcoming pins scheduled.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {pinData.upcomingPins.map((pin) => (
                    <PinListItem key={pin.id} pin={pin} showTime="scheduled" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failed */}
        <TabsContent value={3}>
          <Card>
            <CardContent className="p-0">
              {pinData.failedPins.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No failed pins.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {pinData.failedPins.map((pin) => (
                    <PinListItem key={pin.id} pin={pin} showTime="failed" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Section D: Pipeline Status ===== */}
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

      {/* ===== Section E: Recent Pipeline Runs ===== */}
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
