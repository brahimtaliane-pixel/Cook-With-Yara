"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, User, TrendingUp, Bookmark, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CompetitorRowActions } from "./competitor-row-actions";
import { PinCard } from "./pin-card";
import type { PinData } from "./intel-tabs";

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

interface CompetitorCardProps {
  competitor: Competitor;
  period?: string;
}

export function CompetitorCard({ competitor, period = "month" }: CompetitorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pins, setPins] = useState<PinData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null);

  // Re-fetch when period changes and card is expanded
  useEffect(() => {
    if (expanded && loadedPeriod !== period) {
      fetchPins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function fetchPins() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("competitorId", competitor.id);
      params.set("sort", "score");
      params.set("limit", "500");
      if (period) {
        params.set("period", period);
      }
      const res = await fetch(`/api/admin/intel/pins?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPins(data.pins ?? data);
        setLoadedPeriod(period);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (loadedPeriod !== period) {
      await fetchPins();
    }
  }

  const pinCount = pins.length;
  const topScore = pins.length > 0 ? Math.max(...pins.map((p) => p.trendScore ?? 0)) : 0;
  const totalSaves = pins.reduce((s, p) => s + p.saves, 0);
  const maxVelocity = Math.max(1, ...pins.map((p) => p.velocity));

  return (
    <Card size="sm" className="group">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm">@{competitor.username}</CardTitle>
              <CardDescription className="truncate text-xs">
                {competitor.displayName}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/intel/competitors/${competitor.id}`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Analytics
              <ArrowRight className="size-3" />
            </Link>
            <Badge variant={competitor.isActive ? "default" : "outline"}>
              {competitor.isActive ? "Active" : "Paused"}
            </Badge>
            <CompetitorRowActions competitor={competitor} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Last fetched:{" "}
            {competitor.lastFetchedAt
              ? new Date(competitor.lastFetchedAt).toLocaleDateString()
              : "Never"}
          </span>
          <span>
            Added: {new Date(competitor.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Stats row — only show after pins are loaded */}
        {loadedPeriod && pinCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="size-3" />
              {pinCount} pins
            </span>
            <span className="flex items-center gap-1">
              <Bookmark className="size-3" />
              {totalSaves.toLocaleString()} saves
            </span>
            {topScore > 0 && (
              <Badge variant="outline" className="text-[11px]">
                Top score: {topScore}
              </Badge>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center gap-1.5 text-xs"
          onClick={handleExpand}
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3.5" />
              Hide Pins
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              Show Pins
            </>
          )}
        </Button>
        {expanded && (
          <div className="pt-1">
            {loading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Loading pins...
              </p>
            ) : pins.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No pins tracked yet for this competitor.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {pins.map((pin) => (
                  <PinCard key={pin.id} pin={pin} compact maxVelocity={maxVelocity} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
