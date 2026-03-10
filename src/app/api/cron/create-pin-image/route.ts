import { createCronHandler } from "@/lib/pipeline/base";
import { createPinImage } from "@/lib/pipeline/pin-image";

export const GET = createCronHandler("create-pin-image", async () => {
  return createPinImage();
});
