import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Pin,
  Zap,
  Globe,
  Heart,
  Users,
  SendHorizonal,
  Star,
} from "lucide-react";

export interface IntelStats {
  totalPins: number;
  avgVelocity: number;
  topDomain: string | null;
  thisWeekPins: number;
  activeCompetitors: number;
  pipelineRate: number;
  totalForRate: number;
  totalSaves: number;
  recommendedCount?: number;
}

const metrics: {
  key: keyof IntelStats;
  label: string;
  icon: React.ElementType;
  format: (v: number | string | null | undefined, stats: IntelStats) => string;
  detail?: (stats: IntelStats) => string;
}[] = [
  {
    key: "totalPins",
    label: "Pins Tracked",
    icon: Pin,
    format: (v) => Number(v).toLocaleString(),
    detail: (s) => `${s.thisWeekPins} this week`,
  },
  {
    key: "avgVelocity",
    label: "Avg Velocity",
    icon: Zap,
    format: (v) => `${Number(v).toFixed(1)}/day`,
    detail: () => "saves per day",
  },
  {
    key: "topDomain",
    label: "Top Domain",
    icon: Globe,
    format: (v) => (v ? String(v) : "—"),
    detail: () => "most tracked source",
  },
  {
    key: "recommendedCount",
    label: "Recommended",
    icon: Star,
    format: (v) => String(v ?? 0),
    detail: () => "pins scoring ≥70",
  },
  {
    key: "activeCompetitors",
    label: "Competitors",
    icon: Users,
    format: (v) => String(v),
    detail: () => "actively tracked",
  },
  {
    key: "pipelineRate",
    label: "Pipeline Rate",
    icon: SendHorizonal,
    format: (v, s) =>
      s.totalForRate > 0 ? `${Math.round((Number(v) / s.totalForRate) * 100)}%` : "0%",
    detail: (s) => `${s.pipelineRate} of ${s.totalForRate} sent`,
  },
];

export function StatsBar({ stats }: { stats: IntelStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Card key={m.key} size="sm">
            <CardContent className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <CardDescription className="text-xs">{m.label}</CardDescription>
                <CardTitle className="truncate text-lg leading-tight font-semibold tracking-tight">
                  {m.format(stats[m.key], stats)}
                </CardTitle>
                {m.detail && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {m.detail(stats)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
