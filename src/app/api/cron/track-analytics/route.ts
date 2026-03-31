import { createCronHandler } from "@/lib/pipeline/base";
import { trackPinAnalytics } from "@/lib/pipeline/track-analytics";

export const maxDuration = 120;

export const GET = createCronHandler("track-analytics", async () => {
  return trackPinAnalytics();
});
