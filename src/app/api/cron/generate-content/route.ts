import { createCronHandler } from "@/lib/pipeline/base";
import { generateContent } from "@/lib/pipeline/content";

export const GET = createCronHandler("generate-content", async () => {
  return generateContent();
});
