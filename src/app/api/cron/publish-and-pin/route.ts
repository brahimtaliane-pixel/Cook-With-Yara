import { createCronHandler } from "@/lib/pipeline/base";
import { publishAndPin } from "@/lib/pipeline/publish";

export const GET = createCronHandler("publish-and-pin", async () => {
  return publishAndPin();
});
