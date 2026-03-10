import { createCronHandler } from "@/lib/pipeline/base";
import { discoverKeywords } from "@/lib/pipeline/discover";

export const GET = createCronHandler("discover-keywords", async () => {
  return discoverKeywords();
});
