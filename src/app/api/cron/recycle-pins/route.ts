import { createCronHandler } from "@/lib/pipeline/base";
import { recyclePins } from "@/lib/pipeline/recycle";

export const maxDuration = 120;

export const GET = createCronHandler("recycle-pins", async () => {
  return recyclePins();
});
