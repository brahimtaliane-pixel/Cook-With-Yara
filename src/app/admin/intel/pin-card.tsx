"use client";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SendToPipelineButton } from "./send-to-pipeline-button";
import { Bookmark, Repeat2, User, LayoutGrid, Globe, Check, TrendingUp, TrendingDown, Sparkles, ExternalLink } from "lucide-react";
import type { PinData } from "./intel-tabs";

function getScoreBadgeStyle(tierColor: string) {
  switch (tierColor) {
    case "emerald":
      return "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "blue":
      return "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case "amber":
      return "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "yellow":
      return "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    default:
      return "border-muted bg-muted/50 text-muted-foreground";
  }
}

function ScoreBadge({ score, tierColor }: { score: number; tierColor: string }) {
  const style = getScoreBadgeStyle(tierColor);
  return (
    <span
      className={`inline-flex size-7 items-center justify-center rounded-full border text-xs font-bold tabular-nums ${style}`}
    >
      {score}
    </span>
  );
}

function daysAgo(date: Date | string | null): string {
  if (!date) return "Unknown";
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function getVelocityTier(velocity: number) {
  if (velocity >= 100) return { label: "Viral", color: "bg-red-500", textColor: "text-red-700 dark:text-red-400" };
  if (velocity >= 50) return { label: "Hot", color: "bg-orange-500", textColor: "text-orange-700 dark:text-orange-400" };
  if (velocity >= 10) return { label: "Rising", color: "bg-amber-500", textColor: "text-amber-700 dark:text-amber-400" };
  return { label: "Steady", color: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-400" };
}

function VelocityBadge({ velocity, instantVelocity }: { velocity: number; instantVelocity?: number }) {
  const displayVelocity = instantVelocity && instantVelocity > 0 ? instantVelocity : velocity;
  const tier = getVelocityTier(displayVelocity);
  const showBoth = instantVelocity && instantVelocity > 0 && instantVelocity !== velocity;
  return (
    <Badge variant="outline" className={`text-xs ${tier.textColor}`}>
      {tier.label} · {displayVelocity}/day{showBoth ? ` (avg ${velocity})` : ""}
    </Badge>
  );
}

function TrendDirectionBadge({ direction, acceleration }: { direction: string; acceleration: number }) {
  switch (direction) {
    case "rising":
      return (
        <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400">
          <TrendingUp className="size-3" /> Rising +{acceleration}/d
        </Badge>
      );
    case "falling":
      return (
        <Badge variant="outline" className="text-xs text-red-700 dark:text-red-400">
          <TrendingDown className="size-3" /> Falling {acceleration}/d
        </Badge>
      );
    case "new":
      return (
        <Badge variant="outline" className="text-xs text-blue-700 dark:text-blue-400">
          <Sparkles className="size-3" /> New
        </Badge>
      );
    default:
      return null;
  }
}

function VelocityBar({ velocity, maxVelocity }: { velocity: number; maxVelocity: number }) {
  const tier = getVelocityTier(velocity);
  const pct = maxVelocity > 0 ? Math.max(4, Math.round((velocity / maxVelocity) * 100)) : 4;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${tier.color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface PinCardProps {
  pin: PinData;
  compact?: boolean;
  maxVelocity?: number;
}

function getCardAccent(tierColor?: string) {
  switch (tierColor) {
    case "emerald": return "border-l-emerald-500";
    case "blue": return "border-l-blue-500";
    case "amber": return "border-l-amber-500";
    case "yellow": return "border-l-yellow-500";
    default: return "";
  }
}

export function PinCard({ pin, compact = false, maxVelocity = 0 }: PinCardProps) {
  const imgSize = compact ? "size-14" : "size-20";
  const imgPx = compact ? "56px" : "80px";
  const accent = pin.trendScore != null && pin.trendScore >= 50
    ? `border-l-2 ${getCardAccent(pin.scoreTierColor)}`
    : "";

  return (
    <Card size="sm" className={accent}>
      <CardHeader>
        <div className="flex items-start gap-3">
          {pin.imageUrl ? (
            <div className={`relative ${imgSize} shrink-0 overflow-hidden rounded-md border`}>
              <Image
                src={pin.imageUrl}
                alt={pin.title || "Pin image"}
                fill
                className="object-cover"
                sizes={imgPx}
                unoptimized
              />
            </div>
          ) : (
            <div className={`flex ${imgSize} shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground`}>
              No img
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="line-clamp-2 text-sm leading-tight">
              {pin.title || "Untitled Pin"}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              {pin.trendScore != null && (
                <ScoreBadge score={pin.trendScore} tierColor={pin.scoreTierColor ?? "muted"} />
              )}
              {pin.velocity > 0 && <VelocityBadge velocity={pin.velocity} instantVelocity={pin.instantVelocity} />}
              {pin.trendDirection && (
                <TrendDirectionBadge direction={pin.trendDirection} acceleration={pin.acceleration} />
              )}
              {pin.baselineMultiple > 15 && (
                <span className="text-[10px] text-amber-600 font-medium">
                  {(pin.baselineMultiple / 10).toFixed(1)}x avg
                </span>
              )}
              {pin.sentToPipeline && (
                <Badge variant="secondary" className="text-xs text-green-700 dark:text-green-400">
                  <Check className="size-3" />
                  In Pipeline
                </Badge>
              )}
              {!pin.sentToPipeline && pin.existingArticleStatus && (
                <Badge variant="secondary" className="text-xs text-amber-700 dark:text-amber-400">
                  <Check className="size-3" />
                  Already Written
                </Badge>
              )}
            </div>
            {!compact && pin.competitorUsername && (
              <p className="text-xs text-muted-foreground">
                via @{pin.competitorUsername}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {pin.velocity > 0 && (
          <VelocityBar velocity={pin.velocity} maxVelocity={maxVelocity || pin.velocity} />
        )}
        {!compact && pin.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {pin.description}
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Bookmark className="size-3" />
            {pin.saves.toLocaleString()} saves
          </span>
          <span className="flex items-center gap-1">
            <Repeat2 className="size-3" />
            {pin.repins.toLocaleString()} repins
          </span>
          {!compact && pin.creatorName && (
            <span className="flex items-center gap-1 truncate">
              <User className="size-3 shrink-0" />
              {pin.creatorName}
            </span>
          )}
          {!compact && pin.boardName && (
            <span className="flex items-center gap-1 truncate">
              <LayoutGrid className="size-3 shrink-0" />
              {pin.boardName}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {pin.domain && (
              <span className="flex items-center gap-1">
                <Globe className="size-3" />
                {pin.linkUrl ? (
                  <a
                    href={pin.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {pin.domain}
                  </a>
                ) : (
                  pin.domain
                )}
              </span>
            )}
            <a
              href={`https://www.pinterest.com/pin/${pin.pinId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 hover:underline"
              title="View on Pinterest"
            >
              <ExternalLink className="size-3" />
              Pin
            </a>
            <span>{daysAgo(pin.pinCreatedAt)}</span>
          </div>
          {!compact && (
            pin.existingArticleStatus && !pin.sentToPipeline ? (
              pin.existingArticleUrl ? (
                <a
                  href={pin.existingArticleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-600 hover:text-amber-700 underline"
                >
                  View Article
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">Written</span>
              )
            ) : (
              <SendToPipelineButton
                pinId={pin.id}
                initialSent={pin.sentToPipeline}
              />
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
