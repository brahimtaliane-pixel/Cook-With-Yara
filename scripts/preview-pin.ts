/**
 * Render a pin design for a real published recipe (no posting).
 *   npx tsx scripts/preview-pin.ts                      # newest published, D1
 *   npx tsx scripts/preview-pin.ts --slug=foo --design=1
 * Saves test-pin-d<design>.png (gitignored) and is safe to re-run.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFile } from "fs/promises";
import { db } from "../src/lib/db";
import { articles } from "../src/lib/db/schema";
import { ArticleStatus } from "../src/lib/constants";
import { extractRecipeMeta } from "../src/lib/utils/recipe-meta";
import { generatePinDesign } from "../src/lib/services/canva";
import { generateHeroImage } from "../src/lib/services/nano-banana";
import { put } from "@vercel/blob";
import { and, desc, eq, isNotNull } from "drizzle-orm";

async function main() {
  const slug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
  const design = parseInt(
    process.argv.find((a) => a.startsWith("--design="))?.split("=")[1] ?? "1",
    10,
  );

  const [article] = slug
    ? await db.select().from(articles).where(eq(articles.slug, slug)).limit(1)
    : await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.status, ArticleStatus.PUBLISHED),
            isNotNull(articles.heroImageUrl),
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(1);

  if (!article?.heroImageUrl) throw new Error("No eligible article with a hero image");

  const meta = extractRecipeMeta(article.recipeJsonLd as Record<string, unknown> | null);

  // Faithful preview: if the recipe has no 2nd photo yet, generate one now so
  // the stacked design shows two distinct images (and persist it for reuse).
  let heroImageUrl2 = article.heroImageUrl2 ?? undefined;
  if (!heroImageUrl2 && article.midjourneyPrompt) {
    console.log("Generating a 2nd recipe photo for the preview…");
    const second = await generateHeroImage(
      `${article.midjourneyPrompt} — alternate close-up shot of the same dish from a different angle, same styling and lighting`,
    );
    const ext = second.mimeType === "image/jpeg" ? "jpg" : "png";
    const { url } = await put(`recipes/${article.slug}/hero-2.${ext}`, second.data, {
      access: "public",
      contentType: second.mimeType,
      allowOverwrite: true,
    });
    heroImageUrl2 = url;
    await db.update(articles).set({ heroImageUrl2: url }).where(eq(articles.id, article.id));
  }

  const png = await generatePinDesign(design, {
    title: article.title || "Delicious Recipe",
    heroImageUrl: article.heroImageUrl,
    heroImageUrl2,
    articleNumber: article.articleNumber,
    topIngredients: meta.topIngredients,
    servings: meta.servings,
    cookTime: meta.cookTime,
    eyebrow: meta.eyebrow,
    subtitle: meta.subtitle,
  });

  const path = `test-pin-d${design}.png`;
  await writeFile(path, png);
  console.log(`✓ ${article.title} → ${path}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
