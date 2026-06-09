// Generate a brand-new article (real AI content + hero image) and render the
// two live pin designs (D6 Title Band + D7 Full-Bleed) from it.
// Nothing is written to the DB or posted to Pinterest — output is local PNGs.

import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFile } from "fs/promises";
import { join } from "path";
import { generateArticleContent } from "../src/lib/services/ai-writer";
import { generateHeroImage } from "../src/lib/services/nano-banana";
import {
  generatePinImageEditorial,
  generatePinImageFullBleed,
} from "../src/lib/services/canva";
import { extractRecipeMeta } from "../src/lib/utils/recipe-meta";

async function main() {
  const keyword = process.argv[2] || "honey garlic salmon bites";

  console.log(`\n1/3  Generating article content for: "${keyword}" ...`);
  const t0 = Date.now();
  const article = await generateArticleContent(keyword);
  console.log(`     ✓ "${article.title}"  (${Date.now() - t0}ms)`);

  console.log(`\n2/3  Generating hero image ...`);
  const t1 = Date.now();
  const hero = await generateHeroImage(article.midjourneyPrompt);
  const heroDataUri = `data:${hero.mimeType};base64,${hero.data.toString("base64")}`;
  console.log(`     ✓ ${hero.mimeType}, ${hero.data.length} bytes  (${Date.now() - t1}ms)`);

  const meta = extractRecipeMeta(
    article.recipeJsonLd as Record<string, unknown> | null,
  );
  const pinParams = {
    title: article.title,
    heroImageUrl: heroDataUri,
    articleNumber: 999,
    topIngredients: meta.topIngredients,
    servings: meta.servings,
    cookTime: meta.cookTime,
    eyebrow: meta.eyebrow,
    subtitle: meta.subtitle,
  };
  console.log(`     eyebrow: "${meta.eyebrow}"   subtitle: "${meta.subtitle}"`);

  console.log(`\n3/3  Rendering the two live pin designs ...`);
  const [d6, d7] = await Promise.all([
    generatePinImageEditorial(pinParams),
    generatePinImageFullBleed(pinParams),
  ]);

  const out6 = join(process.cwd(), "test-newarticle-d6-titleband.png");
  const out7 = join(process.cwd(), "test-newarticle-d7-fullbleed.png");
  await writeFile(out6, d6);
  await writeFile(out7, d7);
  console.log(`     ✓ ${out6.split("/").pop()}  (${d6.length} bytes)`);
  console.log(`     ✓ ${out7.split("/").pop()}  (${d7.length} bytes)`);

  console.log(`\nDone. Title: ${article.title}\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
