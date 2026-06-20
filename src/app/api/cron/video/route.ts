import { createCronHandler } from "@/lib/pipeline/base";
import { runVideoStep } from "@/lib/pipeline/video";

// Veo generation + downloading the MP4 can take a little while; give it room.
export const maxDuration = 120;

export const GET = createCronHandler("video", async () => {
  return runVideoStep();
});
