import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineRunStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const runs = await db
    .select()
    .from(pipelineRuns)
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Pipeline Runs</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Finished</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No pipeline runs yet.
              </TableCell>
            </TableRow>
          ) : (
            runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">{run.jobName}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      run.status === PipelineRunStatus.COMPLETED
                        ? "default"
                        : run.status === PipelineRunStatus.RUNNING
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>{run.itemsProcessed}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(run.startedAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {run.finishedAt
                    ? new Date(run.finishedAt).toLocaleString()
                    : "---"}
                </TableCell>
                <TableCell>
                  {run.errorLog ? (
                    <p className="max-w-xs truncate text-xs text-destructive">
                      {run.errorLog}
                    </p>
                  ) : (
                    <span className="text-muted-foreground">---</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
