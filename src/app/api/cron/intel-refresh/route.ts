import { createCronHandler } from "@/lib/pipeline/base";
import { refreshAll } from "@/lib/pipeline/intel-refresh";

export const maxDuration = 300;

export const GET = createCronHandler("intel-refresh", async () => {
  return refreshAll();
});
