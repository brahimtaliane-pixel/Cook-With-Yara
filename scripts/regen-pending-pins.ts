// Re-render every pending pin_queue row with the polished template, keeping
// the existing scheduledAt slots intact. Only the image (and the article's
// pinImageUrl{,2} for D1/D2) gets updated.
//
// Usage:
//   npx tsx scripts/regen-pending-pins.ts            # dry run (default)
//   npx tsx scripts/regen-pending-pins.ts --apply    # actually mutate

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { pinQueue, articles } from "../src/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { put } from "@vercel/blob";
import { generatePinDesign } from "../src/lib/services/canva";
import { extractRecipeMeta } from "../src/lib/utils/recipe-meta";

const APPLY = process.argv.includes("--apply");

function dedupKey(articleId: string, design: number): string {
  return `${articleId}|${design}`;
}

async function main() {
  console.log(
    APPLY ? "MODE: APPLY (will mutate the DB)" : "MODE: DRY RUN (no writes)",
  );
  console.log("─".repeat(70));

  const rows = await db
    .select({ pin: pinQueue, article: articles })
    .from(pinQueue)
    .innerJoin(articles, eq(pinQueue.articleId, articles.id))
    .where(eq(pinQueue.status, "pending"))
    .orderBy(desc(pinQueue.scheduledAt));

  console.log(`Found ${rows.length} pending pin_queue rows\n`);
  if (rows.length === 0) {
    process.exit(0);
  }

  // Cache regenerated images by (articleId, design) — many pending rows share
  // the same (article, design) tuple across boards (e.g., design 1 for the
  // primary board + the same design 1 image for multiboard rows).
  const regenCache = new Map<string, string>();
  let processed = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const { pin, article } of rows) {
    const num = article.articleNumber
      ? `N°${String(article.articleNumber).padStart(3, "0")}`
      : "N°???";
    const label = `${num} D${pin.pinDesign} ${pin.pinType.padEnd(10)} ${(article.title ?? "").slice(0, 46)}`;

    if (!article.heroImageUrl) {
      console.log(`  ✗ SKIP ${label} — no hero image`);
      skipped++;
      continue;
    }

    try {
      const cacheKey = dedupKey(article.id, pin.pinDesign);
      let newImageUrl: string;

      if (regenCache.has(cacheKey)) {
        newImageUrl = regenCache.get(cacheKey)!;
        // Still need to update this row's imageUrl to the (already-uploaded) new URL
        if (APPLY) {
          await db
            .update(pinQueue)
            .set({ imageUrl: newImageUrl })
            .where(eq(pinQueue.id, pin.id));
        }
        console.log(`  ✓ ${label}  (reused cached render)`);
        processed++;
        continue;
      }

      if (APPLY) {
        const meta = extractRecipeMeta(
          article.recipeJsonLd as Record<string, unknown> | null,
        );

        const buf = await generatePinDesign(pin.pinDesign, {
          title: article.title || "Delicious Recipe",
          heroImageUrl: article.heroImageUrl,
          articleNumber: article.articleNumber,
          topIngredients: meta.topIngredients,
          servings: meta.servings,
          cookTime: meta.cookTime,
        });

        // For D1/D2 use stable filenames so the article's pinImageUrl gets the
        // freshest blob. For recycled designs use timestamped names.
        const filename =
          pin.pinDesign === 1
            ? "pin.png"
            : pin.pinDesign === 2
              ? "pin2.png"
              : `pin-recycled-${pin.pinDesign}-${Date.now()}.png`;

        const blob = await put(
          `recipes/${article.slug}/${filename}`,
          buf,
          { access: "public", allowOverwrite: true },
        );
        newImageUrl = blob.url;
        regenCache.set(cacheKey, newImageUrl);

        if (pin.pinDesign === 1) {
          await db
            .update(articles)
            .set({ pinImageUrl: newImageUrl, updatedAt: new Date() })
            .where(eq(articles.id, article.id));
        } else if (pin.pinDesign === 2) {
          await db
            .update(articles)
            .set({ pinImageUrl2: newImageUrl, updatedAt: new Date() })
            .where(eq(articles.id, article.id));
        }

        await db
          .update(pinQueue)
          .set({ imageUrl: newImageUrl })
          .where(eq(pinQueue.id, pin.id));
      } else {
        newImageUrl = `[would-regen D${pin.pinDesign} for ${article.slug}]`;
        regenCache.set(cacheKey, newImageUrl);
      }

      processed++;
      console.log(
        `  ${APPLY ? "✓" : "◦"} ${label}  →  scheduled ${pin.scheduledAt.toISOString().slice(0, 16)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${label}  failed: ${msg}`);
      skipped++;
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("\n" + "─".repeat(70));
  console.log(
    `${APPLY ? "Updated" : "Would update"}: ${processed} | Skipped: ${skipped} | Unique renders: ${regenCache.size} | ${elapsed}s`,
  );

  if (!APPLY) {
    console.log("\nRe-run with --apply to actually mutate the DB.");
  } else {
    console.log(
      "\nDone. Existing schedule preserved — next post-pins cron uses the new images.",
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
