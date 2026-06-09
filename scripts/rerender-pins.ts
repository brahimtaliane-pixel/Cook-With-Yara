// Re-render the pin image (D7 full-bleed hero) for existing articles using the
// current canva.ts renderer, re-upload to the article's stable blob path, and
// update articles.pinImageUrl{,2}. This is what flips already-published
// articles over to the new layout — the create-pin-image cron only renders
// articles still in `image_ready`, so anything already past that needs this.
//
// After running this, also run `scripts/regen-pending-pins.ts --apply` to point
// any still-pending pin_queue rows at the freshly rendered images. Pins already
// posted to Pinterest are immutable and won't change.
//
// Usage:
//   npx tsx scripts/rerender-pins.ts                 # dry run (default)
//   npx tsx scripts/rerender-pins.ts --apply         # actually mutate
//   npx tsx scripts/rerender-pins.ts --apply --limit 5
//   npx tsx scripts/rerender-pins.ts --slug lemon-rhubarb-loaf --apply

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { articles } from "../src/lib/db/schema";
import { and, desc, eq, ilike, inArray, isNotNull } from "drizzle-orm";
import { put } from "@vercel/blob";
import { generatePinImageFullBleed } from "../src/lib/services/canva";
import { extractRecipeMeta } from "../src/lib/utils/recipe-meta";
import { ArticleStatus } from "../src/lib/constants";

const APPLY = process.argv.includes("--apply");

function flagValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const LIMIT = flagValue("--limit") ? parseInt(flagValue("--limit")!, 10) : undefined;
const SLUG_LIKE = flagValue("--slug");

// Articles that have already produced a pin (or are about to) — i.e. anything
// the create-pin-image cron will no longer touch.
const TARGET_STATUSES = [
  ArticleStatus.PIN_READY,
  ArticleStatus.PUBLISHING,
  ArticleStatus.PUBLISHED,
];

async function main() {
  console.log(
    APPLY ? "MODE: APPLY (will mutate the DB)" : "MODE: DRY RUN (no writes)",
  );
  console.log("─".repeat(70));

  const rows = await db
    .select()
    .from(articles)
    .where(
      and(
        inArray(articles.status, TARGET_STATUSES),
        isNotNull(articles.heroImageUrl),
        ...(SLUG_LIKE ? [ilike(articles.slug, `%${SLUG_LIKE}%`)] : []),
      ),
    )
    .orderBy(desc(articles.publishedAt));

  const targets = LIMIT ? rows.slice(0, LIMIT) : rows;
  console.log(
    `Found ${rows.length} candidate articles${LIMIT ? ` (rendering first ${targets.length})` : ""}\n`,
  );
  if (targets.length === 0) process.exit(0);

  let processed = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const article of targets) {
    const num = article.articleNumber
      ? `N°${String(article.articleNumber).padStart(3, "0")}`
      : "N°???";
    const label = `${num} ${(article.title ?? article.slug).slice(0, 52)}`;

    if (!article.heroImageUrl) {
      console.log(`  ✗ SKIP ${label} — no hero image`);
      skipped++;
      continue;
    }

    try {
      if (!APPLY) {
        console.log(`  ◦ ${label}  →  would re-render recipes/${article.slug}/pin.png`);
        processed++;
        continue;
      }

      const meta = extractRecipeMeta(
        article.recipeJsonLd as Record<string, unknown> | null,
      );

      const png = await generatePinImageFullBleed({
        title: article.title || "Delicious Recipe",
        heroImageUrl: article.heroImageUrl,
        articleNumber: article.articleNumber,
        topIngredients: meta.topIngredients,
        servings: meta.servings,
        cookTime: meta.cookTime,
        eyebrow: meta.eyebrow,
        subtitle: meta.subtitle,
      });

      const blob = await put(`recipes/${article.slug}/pin.png`, png, {
        access: "public",
        allowOverwrite: true,
      });

      await db
        .update(articles)
        .set({
          pinImageUrl: blob.url,
          pinImageUrl2: blob.url,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id));

      processed++;
      console.log(`  ✓ ${label}  →  ${blob.url}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${label}  failed: ${msg}`);
      skipped++;
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("\n" + "─".repeat(70));
  console.log(
    `${APPLY ? "Re-rendered" : "Would re-render"}: ${processed} | Skipped: ${skipped} | ${elapsed}s`,
  );

  if (!APPLY) {
    console.log("\nRe-run with --apply to actually mutate the DB.");
  } else {
    console.log(
      "\nDone. Next: `npx tsx scripts/regen-pending-pins.ts --apply` to refresh pending pin_queue rows.",
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
