"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pin,
  Bookmark,
  Repeat2,
  Zap,
  Target,
  SendHorizonal,
} from "lucide-react";
import type { AnalyticsData } from "./competitor-analytics";

const KPI_METRICS = [
  {
    key: "totalPins" as const,
    label: "Total Pins",
    icon: Pin,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "totalSaves" as const,
    label: "Total Saves",
    icon: Bookmark,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "totalRepins" as const,
    label: "Total Repins",
    icon: Repeat2,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "avgVelocity" as const,
    label: "Avg Velocity",
    icon: Zap,
    format: (v: number) => `${v}/day`,
  },
  {
    key: "avgScore" as const,
    label: "Avg Score",
    icon: Target,
    format: (v: number) => String(v),
  },
  {
    key: "pipelineRate" as const,
    label: "Sent to Pipeline",
    icon: SendHorizonal,
    format: (v: number) => String(v),
  },
];

function getTierBarColor(color: string) {
  switch (color) {
    case "emerald":
      return "bg-emerald-500";
    case "blue":
      return "bg-blue-500";
    case "amber":
      return "bg-amber-500";
    case "yellow":
      return "bg-yellow-500";
    default:
      return "bg-muted-foreground/30";
  }
}

function getTierTextColor(color: string) {
  switch (color) {
    case "emerald":
      return "text-emerald-700 dark:text-emerald-400";
    case "blue":
      return "text-blue-700 dark:text-blue-400";
    case "amber":
      return "text-amber-700 dark:text-amber-400";
    case "yellow":
      return "text-yellow-700 dark:text-yellow-400";
    default:
      return "text-muted-foreground";
  }
}

export function AnalyticsOverview({ data }: { data: AnalyticsData }) {
  const maxTierCount = Math.max(1, ...data.tierDistribution.map((t) => t.count));
  const maxFreqCount = Math.max(1, ...data.frequency.map((f) => f.count));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPI_METRICS.map((m) => {
          const Icon = m.icon;
          const value = data.summary[m.key];
          return (
            <Card key={m.key} size="sm">
              <CardContent className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <CardDescription className="text-xs">
                    {m.label}
                  </CardDescription>
                  <CardTitle className="truncate text-lg font-semibold leading-tight tracking-tight">
                    {m.format(value)}
                  </CardTitle>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Score Tier Distribution */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Score Distribution</CardTitle>
          <CardDescription className="text-xs">
            Pin count by quality tier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.tierDistribution.map((tier) => {
            const pct =
              maxTierCount > 0
                ? Math.max(2, Math.round((tier.count / maxTierCount) * 100))
                : 2;
            return (
              <div key={tier.tier} className="flex items-center gap-3">
                <span
                  className={`w-24 shrink-0 text-xs font-medium ${getTierTextColor(tier.color)}`}
                >
                  {tier.tier}
                </span>
                <div className="flex-1">
                  <div className="h-5 w-full rounded bg-muted">
                    <div
                      className={`flex h-full items-center rounded px-2 text-[11px] font-medium text-white transition-all ${getTierBarColor(tier.color)}`}
                      style={{ width: `${pct}%` }}
                    >
                      {tier.count > 0 && tier.count}
                    </div>
                  </div>
                </div>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {tier.count}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Domain Breakdown */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Domain Breakdown</CardTitle>
            <CardDescription className="text-xs">
              Top link domains by pin count
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.domains.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No domain data
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Domain</TableHead>
                    <TableHead className="text-right text-xs">Pins</TableHead>
                    <TableHead className="text-right text-xs">Saves</TableHead>
                    <TableHead className="text-right text-xs">
                      Avg Saves
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.domains.map((d) => (
                    <TableRow key={d.domain}>
                      <TableCell className="truncate text-xs font-medium">
                        {d.domain}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {d.count}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {d.totalSaves.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {d.avgSaves.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Posting Frequency */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Posting Frequency</CardTitle>
            <CardDescription className="text-xs">
              Pin activity over time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.frequency.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No frequency data
              </p>
            ) : (
              data.frequency.map((f) => {
                const pct = Math.max(
                  4,
                  Math.round((f.count / maxFreqCount) * 100)
                );
                return (
                  <div key={f.period} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {f.period}
                    </span>
                    <div className="flex-1">
                      <div className="h-4 w-full rounded bg-muted">
                        <div
                          className="h-full rounded bg-primary/70 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {f.count} pins
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
