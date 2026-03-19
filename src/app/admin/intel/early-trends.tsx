"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, Zap } from "lucide-react";
import { PinCard } from "./pin-card";
import type { PinData } from "./intel-tabs";

interface EarlyTrendsSummary {
  totalRising: number;
  avgAcceleration: number;
  topAcceleratingTitle: string | null;
  topAcceleration: number;
}

interface EarlyTrendsResponse {
  pins: PinData[];
  summary: EarlyTrendsSummary;
}

export function EarlyTrends({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [data, setData] = useState<EarlyTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEarlyTrends() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/intel/early-trends");
        if (res.ok) {
          const json: EarlyTrendsResponse = await res.json();
          setData(json);
          onCountChange?.(json.summary.totalRising);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchEarlyTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Scanning for early trends...
      </div>
    );
  }

  if (!data || data.pins.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Zap className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No early trends detected</p>
          <p className="max-w-sm text-center text-xs text-muted-foreground">
            Early trends appear when pins created in the last 14 days show rising
            acceleration with fewer than 500 saves.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { pins, summary } = data;
  const maxVelocity = Math.max(1, ...pins.map((p) => p.velocity));

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <CardTitle className="text-sm">Acceleration Alert</CardTitle>
          </div>
          <CardDescription>
            {summary.totalRising} pin{summary.totalRising !== 1 ? "s" : ""} accelerating
            right now, avg +{summary.avgAcceleration} saves/day acceleration
          </CardDescription>
        </CardHeader>
        {summary.topAcceleratingTitle && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Top accelerating: <span className="font-medium text-foreground">{summary.topAcceleratingTitle}</span>
              {" "}(+{summary.topAcceleration}/day)
            </p>
          </CardContent>
        )}
      </Card>

      {/* Pin Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pins.map((pin) => (
          <div key={pin.id} className="relative">
            {pin.acceleration > 20 && (
              <div className="absolute -top-2 -right-2 z-10 flex size-6 items-center justify-center rounded-full bg-amber-500 text-white">
                <AlertTriangle className="size-3.5" />
              </div>
            )}
            <PinCard pin={pin} maxVelocity={maxVelocity} />
          </div>
        ))}
      </div>
    </div>
  );
}
