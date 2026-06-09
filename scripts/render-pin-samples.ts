// Render all 5 pin designs using a local hero image so we can eyeball them.

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  generatePinImage,
  generatePinImageSimple,
  generatePinImageBoldOverlay,
  generatePinImageCard,
  generatePinImageMinimal,
  generatePinImageEditorial,
  generatePinImageFullBleed,
} from "../src/lib/services/canva";

async function main() {
  const heroPath = join(process.cwd(), "test-midjourney.png");
  const heroBuf = await readFile(heroPath);
  const heroDataUri = `data:image/png;base64,${heroBuf.toString("base64")}`;

  const sample = {
    title: "Mediterranean Baked Feta Eggs",
    heroImageUrl: heroDataUri,
    articleNumber: 42,
    servings: "4",
    cookTime: "30 min",
    topIngredients: [
      "block of feta cheese",
      "cherry tomatoes",
      "fresh eggs",
      "extra-virgin olive oil",
    ],
    eyebrow: "SPRING RECIPE",
    subtitle: "Zesty & Tart Bake",
  };

  const designs = [
    { num: 1, name: "cover-story", fn: generatePinImage },
    { num: 2, name: "full-bleed-cover", fn: generatePinImageSimple },
    { num: 3, name: "feature-spread", fn: generatePinImageBoldOverlay },
    { num: 4, name: "recipe-card", fn: generatePinImageCard },
    { num: 5, name: "editorial-index", fn: generatePinImageMinimal },
    { num: 6, name: "editorial-luxury", fn: generatePinImageEditorial },
    { num: 7, name: "full-bleed-hero", fn: generatePinImageFullBleed },
  ];

  for (const d of designs) {
    const t0 = Date.now();
    const buf = await d.fn(sample);
    const out = join(process.cwd(), `test-pin-d${d.num}-${d.name}.png`);
    await writeFile(out, buf);
    console.log(`  D${d.num} ${d.name.padEnd(20)} ${buf.length.toString().padStart(7)} bytes  (${Date.now() - t0}ms)  → ${out.split("/").pop()}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
