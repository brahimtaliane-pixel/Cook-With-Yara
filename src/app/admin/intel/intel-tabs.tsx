"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Users,
  Search,
  Zap,
  Download,
} from "lucide-react";
import { StatsBar, type IntelStats } from "./stats-bar";
import { TrendingSummary } from "./trending-summary";
import { CompetitorCard } from "./competitor-card";
import { PinCard } from "./pin-card";
import { PinFilters } from "./pin-filters";
import { PinLookupForm } from "./pin-lookup-form";
import { AddCompetitorForm } from "./add-competitor-form";
import { RefreshButton } from "./refresh-button";
import { EarlyTrends } from "./early-trends";

interface Competitor {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  isActive: boolean;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PinData {
  id: string;
  pinId: string;
  competitorId: string | null;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  domain: string;
  saves: number;
  repins: number;
  velocity: number;
  instantVelocity: number;
  acceleration: number;
  baselineMultiple: number;
  trendDirection: string;
  creatorName: string;
  creatorFollowers?: number;
  boardName: string;
  pinCreatedAt: Date | null;
  source: string;
  sentToPipeline: boolean;
  discoveredAt: Date;
  competitorUsername?: string | null;
  trendScore?: number;
  scoreTier?: string;
  scoreTierColor?: string;
  existingArticleStatus?: string | null;
  existingArticleUrl?: string | null;
}

interface IntelTabsProps {
  competitors: Competitor[];
  trendingPins: PinData[];
  stats: IntelStats;
}

const PERIODS = [
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
  { value: "today", label: "Today" },
] as const;

export function IntelTabs({ competitors, trendingPins, stats }: IntelTabsProps) {
  const router = useRouter();
  const [trending, setTrending] = useState<PinData[]>(trendingPins);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [refreshingTrending, setRefreshingTrending] = useState(false);
  const [lookupResult, setLookupResult] = useState<PinData | null>(null);
  const [period, setPeriod] = useState("month");
  const [localFilters, setLocalFilters] = useState<{ minSaves?: number; minScore?: number; sort?: string }>({});
  const [earlyTrendsCount, setEarlyTrendsCount] = useState(0);

  const fetchTrending = useCallback(
    async (filters: { minSaves?: number; minScore?: number; sort?: string; period?: string }) => {
      setTrendingLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.minSaves) params.set("minSaves", String(filters.minSaves));
        if (filters.minScore) params.set("minScore", String(filters.minScore));
        if (filters.sort) params.set("sort", filters.sort || "score");
        if (filters.period)
          params.set("period", filters.period);
        params.set("limit", "500");
        const res = await fetch(`/api/admin/intel/pins?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setTrending(data.pins ?? data);
        }
      } finally {
        setTrendingLoading(false);
      }
    },
    []
  );

  function handlePeriodChange(newPeriod: string) {
    setPeriod(newPeriod);
    fetchTrending({
      ...localFilters,
      period: newPeriod,
    });
  }

  function handleFilterChange(filters: { minSaves?: number; minScore?: number; sort?: string }) {
    setLocalFilters(filters);
    fetchTrending({ ...filters, period });
  }

  async function handleRefreshTrending() {
    setRefreshingTrending(true);
    try {
      await fetch("/api/admin/intel/refresh", { method: "POST" });
      router.refresh();
    } finally {
      setRefreshingTrending(false);
    }
  }

  function handleExportCSV() {
    const params = new URLSearchParams();
    if (localFilters.minSaves) params.set("minSaves", String(localFilters.minSaves));
    if (localFilters.minScore) params.set("minScore", String(localFilters.minScore));
    if (localFilters.sort) params.set("sort", localFilters.sort);
    if (period) params.set("period", period);
    const url = `/api/admin/intel/export?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const maxVelocity = Math.max(1, ...trending.map((p) => p.velocity));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Pinterest Intel</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border p-0.5">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handlePeriodChange(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
          >
            <Download className="size-3.5" data-icon="inline-start" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshTrending}
            disabled={refreshingTrending}
          >
            <RefreshCw
              className={`size-3.5 ${refreshingTrending ? "animate-spin" : ""}`}
              data-icon="inline-start"
            />
            {refreshingTrending ? "Refreshing..." : "Refresh All"}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={stats} />

      {/* Tabs */}
      <Tabs defaultValue={0}>
        <TabsList variant="line">
          <TabsTrigger value={0}>
            <TrendingUp className="size-4" />
            Trending
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
              {trending.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Zap className="size-4" />
            Early Trends
            {earlyTrendsCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                {earlyTrendsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value={2}>
            <Users className="size-4" />
            Competitors
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
              {competitors.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value={3}>
            <Search className="size-4" />
            Lookup
          </TabsTrigger>
        </TabsList>

        {/* Trending Tab */}
        <TabsContent value={0} className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <PinFilters onChange={handleFilterChange} />
          </div>

          <TrendingSummary pins={trending} />

          {trendingLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading trending pins...
            </div>
          ) : trending.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <AlertCircle className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No trending pins yet</p>
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                  Click &quot;Refresh All&quot; to discover trending recipe pins
                  from Pinterest. Requires APIFY_TOKEN in environment variables.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshTrending}
                  disabled={refreshingTrending}
                >
                  <RefreshCw
                    className={`size-3.5 ${refreshingTrending ? "animate-spin" : ""}`}
                    data-icon="inline-start"
                  />
                  {refreshingTrending ? "Discovering..." : "Discover Trending Pins"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((pin) => (
                <PinCard key={pin.id} pin={pin} maxVelocity={maxVelocity} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Early Trends Tab */}
        <TabsContent value={1} className="space-y-4 pt-4">
          <EarlyTrends onCountChange={setEarlyTrendsCount} />
        </TabsContent>

        {/* Competitors Tab */}
        <TabsContent value={2} className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <AddCompetitorForm />
            <RefreshButton />
          </div>
          {competitors.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Users className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No competitors tracked</p>
                <p className="text-xs text-muted-foreground">
                  Add a Pinterest username above to start tracking.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {competitors.map((c) => (
                <CompetitorCard key={c.id} competitor={c} period={period} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Lookup Tab */}
        <TabsContent value={3} className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pin Lookup</CardTitle>
              <CardDescription>
                Paste a Pinterest pin URL to fetch its data and metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PinLookupForm onResult={setLookupResult} />
              {lookupResult && (
                <div className="max-w-sm">
                  <PinCard pin={lookupResult} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
