// One-off: render the D7 full-bleed-hero pin for an existing published article
// and post it directly to Pinterest so we can eyeball the design live.

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { articles } from "../src/lib/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";
import { put } from "@vercel/blob";
import { generatePinImageFullBleed } from "../src/lib/services/canva";
import { createPin, fetchBoards } from "../src/lib/services/pinterest";

const ARTICLE_TITLE_LIKE = "%Lemon Rhubarb Loaf%";
const BOARD_NAME = "Desserts & Sweet Treats";
const EYEBROW = "EASY SPRING RECIPE";
const SUBTITLE = "MOIST • SOFT • EASY";
const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cookwithyara.com";

async function main() {
  console.log(`Looking up article matching '${ARTICLE_TITLE_LIKE}'...`);
  const [article] = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.status, "published"),
        ilike(articles.title, ARTICLE_TITLE_LIKE),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(1);

  if (!article) throw new Error("No matching published article found");
  if (!article.heroImageUrl) throw new Error(`Article ${article.slug} has no heroImageUrl`);

  console.log(`Found: "${article.title}"`);
  console.log(`  slug: ${article.slug}`);
  console.log(`  hero: ${article.heroImageUrl}`);

  console.log("\nResolving Pinterest board id...");
  const boards = await fetchBoards();
  const board = boards.find((b) => b.name === BOARD_NAME);
  if (!board) {
    console.log(`Available boards: ${boards.map((b) => b.name).join(", ")}`);
    throw new Error(`Board '${BOARD_NAME}' not found`);
  }
  console.log(`  board: ${board.name} (${board.id})`);

  console.log("\nGenerating D7 full-bleed PNG...");
  const t0 = Date.now();
  const png = await generatePinImageFullBleed({
    title: article.title ?? "Recipe",
    heroImageUrl: article.heroImageUrl,
    articleNumber: article.articleNumber,
    eyebrow: EYEBROW,
    subtitle: SUBTITLE,
  });
  console.log(`  rendered ${png.length} bytes in ${Date.now() - t0}ms`);

  console.log("\nUploading to Vercel Blob...");
  const blob = await put(`recipes/${article.slug}/pin-d7.png`, png, {
    access: "public",
    allowOverwrite: true,
  });
  console.log(`  blob: ${blob.url}`);

  const link = `${SITE_BASE}/recipes/${article.slug}`;
  const description =
    article.metaDescription ??
    `${article.title} — from ${SITE_BASE.replace(/^https?:\/\//, "")}`;

  console.log("\nPosting pin to Pinterest...");
  const pin = await createPin({
    boardId: board.id,
    title: article.title ?? "Recipe",
    description,
    link,
    imageUrl: blob.url,
    altText: `${article.title} pin image`,
  });

  console.log(`\n✓ Pin created:`);
  console.log(`  pin id: ${pin.id}`);
  console.log(`  url:    https://www.pinterest.com/pin/${pin.id}/`);
  console.log(`  link:   ${link}`);
  console.log(`  image:  ${blob.url}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("\nFAILED:");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
