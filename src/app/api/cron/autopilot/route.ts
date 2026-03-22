import { createCronHandler } from "@/lib/pipeline/base";
import { runAutopilot } from "@/lib/pipeline/autopilot";

export const maxDuration = 60;

export const GET = createCronHandler("autopilot", async (runId) => {
  return runAutopilot(runId);
});
