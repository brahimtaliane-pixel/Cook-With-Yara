import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { PinData } from "./intel-tabs";

const TIER_STYLES: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  yellow: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  muted: "bg-muted text-muted-foreground",
};

export function TrendingSummary({ pins }: { pins: PinData[] }) {
  if (pins.length === 0) return null;

  const count = pins.length;

  // Tier breakdown
  const tierCounts = { "Must Write": 0, Strong: 0, Promising: 0, Watch: 0, "Low Priority": 0 };
  const tierColors: Record<string, string> = {
    "Must Write": "emerald",
    Strong: "blue",
    Promising: "amber",
    Watch: "yellow",
    "Low Priority": "muted",
  };
  let totalScore = 0;
  let risingCount = 0;

  for (const pin of pins) {
    const tier = pin.scoreTier ?? "Low Priority";
    if (tier in tierCounts) tierCounts[tier as keyof typeof tierCounts]++;
    totalScore += pin.trendScore ?? 0;
    if (pin.trendDirection === "rising") risingCount++;
  }

  const avgScore = Math.round(totalScore / count);

  // Top domains by frequency
  const domainCounts = new Map<string, number>();
  for (const pin of pins) {
    if (pin.domain) {
      domainCounts.set(pin.domain, (domainCounts.get(pin.domain) || 0) + 1);
    }
  }
  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <Card size="sm">
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Stat label="Avg Score" value={String(avgScore)} />
          {risingCount > 0 && (
            <>
              <Separator orientation="vertical" className="hidden h-4 sm:block" />
              <Stat label="Rising" value={String(risingCount)} />
            </>
          )}
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.entries(tierCounts) as [string, number][])
              .filter(([, n]) => n > 0)
              .map(([tier, n]) => (
                <Badge
                  key={tier}
                  variant="outline"
                  className={`text-[11px] ${TIER_STYLES[tierColors[tier]] ?? ""}`}
                >
                  {n} {tier}
                </Badge>
              ))}
          </div>
          {topDomains.length > 0 && (
            <>
              <Separator orientation="vertical" className="hidden h-4 sm:block" />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Top:</span>
                {topDomains.map(([domain, n]) => (
                  <Badge key={domain} variant="outline" className="text-[11px]">
                    {domain} ({n})
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
