import { createCronHandler } from "@/lib/pipeline/base";
import { cleanup } from "@/lib/pipeline/cleanup";

export const GET = createCronHandler("cleanup", async () => {
  return cleanup();
});
