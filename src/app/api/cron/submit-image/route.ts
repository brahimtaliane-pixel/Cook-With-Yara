import { createCronHandler } from "@/lib/pipeline/base";
import { submitImage } from "@/lib/pipeline/image";

export const GET = createCronHandler("submit-image", async () => {
  return submitImage();
});
