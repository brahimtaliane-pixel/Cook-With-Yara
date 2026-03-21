import { createCronHandler } from "@/lib/pipeline/base";
import { processNextPin } from "@/lib/pipeline/pin-scheduler";

export const maxDuration = 60;

export const GET = createCronHandler("post-pins", async (runId) => {
  return processNextPin(runId);
});
