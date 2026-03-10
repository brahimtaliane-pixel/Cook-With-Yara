import { createCronHandler } from "@/lib/pipeline/base";
import { pollImages } from "@/lib/pipeline/image";

export const GET = createCronHandler("poll-images", async () => {
  return pollImages();
});
