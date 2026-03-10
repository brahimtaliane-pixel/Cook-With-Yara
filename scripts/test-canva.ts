/**
 * Test Script: Pin Image Generator (Satori)
 * Run: npx tsx scripts/test-canva.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { generatePinImage, generatePinImageSimple } from "../src/lib/services/canva";
import { writeFile } from "fs/promises";
import { join } from "path";

const IMAGE_URL =
  "https://images.imaginepro.ai/cdn-new/mj/1094fa94-b6e8-4c81-9fce-fbf7bac3a697.png?index=1";

async function main() {
  console.log("Generating pin designs...\n");

  const [pin1, pin2] = await Promise.all([
    generatePinImage({ title: "Crockpot Chicken Tacos", heroImageUrl: IMAGE_URL }),
    generatePinImageSimple({ title: "Crockpot Chicken Tacos", heroImageUrl: IMAGE_URL }),
  ]);

  const path1 = join(process.cwd(), "test-pin-design1.png");
  const path2 = join(process.cwd(), "test-pin-design2.png");
  await Promise.all([writeFile(path1, pin1), writeFile(path2, pin2)]);

  console.log(`Design 1 (dual image + title): ${path1} (${(pin1.length / 1024).toFixed(0)} KB)`);
  console.log(`Design 2 (full image + logo):  ${path2} (${(pin2.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
