import { createCronHandler } from "@/lib/pipeline/base";
import { runPipelineMonitor } from "@/lib/pipeline/monitor";

export const maxDuration = 60;

export const GET = createCronHandler("pipeline-monitor", async () => {
  return runPipelineMonitor();
});
