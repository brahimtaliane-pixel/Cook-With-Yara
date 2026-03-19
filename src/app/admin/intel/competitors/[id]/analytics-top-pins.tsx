"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PinCard } from "@/app/admin/intel/pin-card";
import type { TopPin } from "./competitor-analytics";
import type { PinData } from "@/app/admin/intel/intel-tabs";

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "saves", label: "Saves" },
  { value: "velocity", label: "Velocity" },
  { value: "acceleration", label: "Acceleration" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

function toPinData(pin: TopPin): PinData {
  return {
    id: pin.id,
    pinId: pin.pinId,
    competitorId: null,
    title: pin.title,
    description: pin.description,
    imageUrl: pin.imageUrl,
    linkUrl: pin.linkUrl,
    domain: pin.domain,
    saves: pin.saves,
    repins: pin.repins,
    velocity: pin.velocity,
    instantVelocity: pin.instantVelocity,
    acceleration: pin.acceleration,
    baselineMultiple: pin.baselineMultiple,
    trendDirection: pin.trendDirection,
    creatorName: pin.creatorName,
    creatorFollowers: pin.creatorFollowers,
    boardName: pin.boardName,
    pinCreatedAt: pin.pinCreatedAt ? new Date(pin.pinCreatedAt) : null,
    source: pin.source,
    sentToPipeline: pin.sentToPipeline,
    discoveredAt: pin.discoveredAt ? new Date(pin.discoveredAt) : new Date(),
    trendScore: pin.trendScore,
    scoreTier: pin.scoreTier,
    scoreTierColor: pin.scoreTierColor,
  };
}

interface AnalyticsTopPinsProps {
  topPins: TopPin[];
}

export function AnalyticsTopPins({ topPins }: AnalyticsTopPinsProps) {
  const [sort, setSort] = useState<SortKey>("score");

  const pins = useMemo(() => {
    const sorted = [...topPins];
    switch (sort) {
      case "saves":
        sorted.sort((a, b) => b.saves - a.saves);
        break;
      case "velocity":
        sorted.sort((a, b) => b.velocity - a.velocity);
        break;
      case "acceleration":
        sorted.sort((a, b) => b.acceleration - a.acceleration);
        break;
      case "score":
      default:
        sorted.sort((a, b) => b.trendScore - a.trendScore);
        break;
    }
    return sorted;
  }, [topPins, sort]);

  const maxVelocity = Math.max(1, ...pins.map((p) => p.velocity));

  return (
    <div className="space-y-4">
      {/* Sort Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        <div className="flex items-center rounded-lg border p-0.5">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={sort === opt.value ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSort(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {pins.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No pins found for this period.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pins.map((pin) => (
            <PinCard
              key={pin.id}
              pin={toPinData(pin)}
              maxVelocity={maxVelocity}
            />
          ))}
        </div>
      )}
    </div>
  );
}
