"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  LayoutGrid,
  Lightbulb,
  Download,
} from "lucide-react";
import { AnalyticsOverview } from "./analytics-overview";
import { AnalyticsTopPins } from "./analytics-top-pins";
import { AnalyticsBoards } from "./analytics-boards";
import { AnalyticsThemes } from "./analytics-themes";

const PERIODS = [
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
  { value: "today", label: "Today" },
] as const;

export interface AnalyticsData {
  summary: {
    totalPins: number;
    totalSaves: number;
    totalRepins: number;
    avgSaves: number;
    avgVelocity: number;
    avgScore: number;
    avgAcceleration: number;
    risingCount: number;
    pipelineRate: number;
  };
  tierDistribution: { tier: string; color: string; count: number }[];
  trendBreakdown: { rising: number; stable: number; falling: number; new: number };
  topPins: TopPin[];
  domains: { domain: string; count: number; totalSaves: number; avgSaves: number }[];
  boards: {
    boardName: string;
    count: number;
    totalSaves: number;
    avgVelocity: number;
    topScore: number;
    topTier: string;
    topTierColor: string;
  }[];
  frequency: { period: string; count: number; totalSaves: number }[];
  themes: { theme: string; count: number; avgScore: number; example: string }[];
}

export interface TopPin {
  id: string;
  pinId: string;
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
  creatorFollowers: number;
  boardName: string;
  pinCreatedAt: string | null;
  source: string;
  sentToPipeline: boolean;
  discoveredAt: string;
  trendScore: number;
  scoreTier: string;
  scoreTierColor: string;
}

export function CompetitorAnalytics({ competitorId }: { competitorId: string }) {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", p);
      const res = await fetch(
        `/api/admin/intel/competitors/${competitorId}/analytics?${params.toString()}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [competitorId]);

  useEffect(() => {
    fetchAnalytics(period);
  }, [period, fetchAnalytics]);

  function handlePeriodChange(newPeriod: string) {
    setPeriod(newPeriod);
  }

  function handleExport() {
    const params = new URLSearchParams();
    params.set("competitorId", competitorId);
    params.set("period", period);
    const url = `/api/admin/intel/export?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="space-y-6">
      {/* Period Toggle + Export */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5" data-icon="inline-start" />
          Export
        </Button>
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          Loading analytics...
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          Failed to load analytics.
        </div>
      ) : (
        <Tabs defaultValue={0}>
          <TabsList variant="line">
            <TabsTrigger value={0}>
              <BarChart3 className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value={1}>
              <TrendingUp className="size-4" />
              Top Pins
              <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">
                {data.summary.totalPins}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value={2}>
              <LayoutGrid className="size-4" />
              Boards
              <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">
                {data.boards.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value={3}>
              <Lightbulb className="size-4" />
              Themes
              <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">
                {data.themes.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={0} className="pt-4">
            <AnalyticsOverview data={data} />
          </TabsContent>
          <TabsContent value={1} className="pt-4">
            <AnalyticsTopPins topPins={data.topPins} />
          </TabsContent>
          <TabsContent value={2} className="pt-4">
            <AnalyticsBoards boards={data.boards} />
          </TabsContent>
          <TabsContent value={3} className="pt-4">
            <AnalyticsThemes themes={data.themes} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
