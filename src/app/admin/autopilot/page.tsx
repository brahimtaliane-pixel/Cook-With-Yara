import { db } from "@/lib/db";
import { autopilotDecisions, pipelineRuns } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";

const DECISION_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  selected: { label: "Selected", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  skipped_duplicate: { label: "Duplicate", variant: "secondary" },
  skipped_limit: { label: "Limit", variant: "outline" },
};

export default async function AutopilotPage() {
  const decisions = await db
    .select({
      id: autopilotDecisions.id,
      pinTitle: autopilotDecisions.pinTitle,
      pinScore: autopilotDecisions.pinScore,
      decision: autopilotDecisions.decision,
      reason: autopilotDecisions.reason,
      createdAt: autopilotDecisions.createdAt,
      runId: autopilotDecisions.runId,
    })
    .from(autopilotDecisions)
    .orderBy(desc(autopilotDecisions.createdAt))
    .limit(100);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      selected: sql<number>`count(*) filter (where ${autopilotDecisions.decision} = 'selected')::int`,
      rejected: sql<number>`count(*) filter (where ${autopilotDecisions.decision} = 'rejected')::int`,
      duplicates: sql<number>`count(*) filter (where ${autopilotDecisions.decision} = 'skipped_duplicate')::int`,
    })
    .from(autopilotDecisions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auto-Pilot Decisions</h1>
        <p className="text-muted-foreground">
          AI-powered trend selection log
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Evaluated</p>
          <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Selected</p>
          <p className="text-2xl font-bold text-green-600">
            {stats?.selected ?? 0}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Rejected</p>
          <p className="text-2xl font-bold text-red-600">
            {stats?.rejected ?? 0}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Duplicates</p>
          <p className="text-2xl font-bold text-muted-foreground">
            {stats?.duplicates ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Pin Title</th>
              <th className="px-4 py-3 text-left font-medium w-20">Score</th>
              <th className="px-4 py-3 text-left font-medium w-28">Decision</th>
              <th className="px-4 py-3 text-left font-medium">Reason</th>
              <th className="px-4 py-3 text-left font-medium w-36">Time</th>
            </tr>
          </thead>
          <tbody>
            {decisions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No decisions yet. Enable Auto-Pilot in Config to start.
                </td>
              </tr>
            ) : (
              decisions.map((d) => {
                const badge = DECISION_BADGE[d.decision] ?? {
                  label: d.decision,
                  variant: "outline" as const,
                };
                return (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="px-4 py-3 max-w-[300px] truncate">
                      {d.pinTitle}
                    </td>
                    <td className="px-4 py-3 font-mono">{d.pinScore}</td>
                    <td className="px-4 py-3">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate">
                      {d.reason}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
