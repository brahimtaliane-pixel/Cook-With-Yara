import { createCronHandler } from "@/lib/pipeline/base";
import { approveKeywords } from "@/lib/pipeline/approve";

export const GET = createCronHandler("approve-keywords", async () => {
  return approveKeywords();
});
