// Re-queue every pin_queue row stuck in 'failed' status by regenerating its
// image with the new editorial template and resetting its slot/retry state.
//
// Usage:
//   npx tsx scripts/requeue-failed-pins.ts            # dry run (default)
//   npx tsx scripts/requeue-failed-pins.ts --apply    # actually mutate

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { pinQueue, articles } from "../src/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { put } from "@vercel/blob";
import { generatePinDesign } from "../src/lib/services/canva";
import { extractRecipeMeta } from "../src/lib/utils/recipe-meta";
import { getNextPostingSlot } from "../src/lib/pipeline/schedule";

const APPLY = process.argv.includes("--apply");
const CLEAN_DUPES = process.argv.includes("--clean-dupes");

function dedupKey(articleId: string, design: number, boardId: string | null): string {
  return `${articleId}|${design}|${boardId ?? ""}`;
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (will mutate the DB)" : "MODE: DRY RUN (no writes)");
  if (CLEAN_DUPES) console.log("       + deleting duplicate failed rows (--clean-dupes)");
  console.log("─".repeat(70));

  // Pull every failed row, newest first so the "keeper" in each dedup group
  // is the most recently inserted one.
  const failedRows = await db
    .select({ pin: pinQueue, article: articles })
    .from(pinQueue)
    .innerJoin(articles, eq(pinQueue.articleId, articles.id))
    .where(eq(pinQueue.status, "failed"))
    .orderBy(desc(pinQueue.createdAt));

  console.log(`Found ${failedRows.length} failed pin_queue rows total\n`);
  if (failedRows.length === 0) return;

  // Pull every (article, design, board) combo that already has a posted row,
  // so we don't double-post something Pinterest already accepted.
  const postedRows = await db
    .select({
      articleId: pinQueue.articleId,
      pinDesign: pinQueue.pinDesign,
      boardId: pinQueue.boardId,
    })
    .from(pinQueue)
    .where(eq(pinQueue.status, "posted"));
  const alreadyPosted = new Set(
    postedRows.map((r) => dedupKey(r.articleId, r.pinDesign, r.boardId)),
  );
  console.log(`${alreadyPosted.size} (article, design, board) combos already have a posted pin — those will be skipped.\n`);

  // Group failed rows by (article, design, board). Keeper = first seen
  // (newest, since we sorted DESC). The rest are duplicates.
  const keepers: typeof failedRows = [];
  const duplicates: typeof failedRows = [];
  const skippedAlreadyPosted: typeof failedRows = [];
  const seen = new Set<string>();

  for (const row of failedRows) {
    const key = dedupKey(row.pin.articleId, row.pin.pinDesign, row.pin.boardId);
    if (alreadyPosted.has(key)) {
      skippedAlreadyPosted.push(row);
      continue;
    }
    if (seen.has(key)) {
      duplicates.push(row);
      continue;
    }
    seen.add(key);
    keepers.push(row);
  }

  console.log(
    `Keepers (will requeue):           ${keepers.length}\n` +
    `Duplicates (left as failed):      ${duplicates.length}\n` +
    `Skipped — already posted combo:   ${skippedAlreadyPosted.length}\n`,
  );

  const rows = keepers;

  // Cache so we don't regenerate the same (article, design) combo twice in one run.
  // Many failed rows share design 1 (original + multiboard both use pin.png).
  const regenCache = new Map<string, string>();

  let processed = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const { pin, article } of rows) {
    const num = article.articleNumber
      ? `N°${String(article.articleNumber).padStart(3, "0")}`
      : "N°???";
    const label = `${num} D${pin.pinDesign} ${pin.pinType.padEnd(10)} ${(article.title ?? "").slice(0, 48)}`;

    if (!article.heroImageUrl) {
      console.log(`  ✗ SKIP ${label} — no hero image`);
      skipped++;
      continue;
    }

    try {
      const cacheKey = `${article.id}:${pin.pinDesign}`;
      let newImageUrl: string;

      if (regenCache.has(cacheKey)) {
        newImageUrl = regenCache.get(cacheKey)!;
      } else {
        const meta = extractRecipeMeta(
          article.recipeJsonLd as Record<string, unknown> | null,
        );

        if (APPLY) {
          const buf = await generatePinDesign(pin.pinDesign, {
            title: article.title || "Delicious Recipe",
            heroImageUrl: article.heroImageUrl,
            articleNumber: article.articleNumber,
            topIngredients: meta.topIngredients,
            servings: meta.servings,
            cookTime: meta.cookTime,
          });

          // For D1/D2 reuse the stable filename so the article's pinImageUrl
          // updates to the freshest version. For D3-D5 (recycled), use a
          // timestamped name like the recycle pipeline does.
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

          // Keep article.pinImageUrl{,2} pointing at the freshest D1/D2 blob,
          // so any consumer (sitemap, OG tags, etc.) gets the new design too.
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
        } else {
          newImageUrl = `[would-generate D${pin.pinDesign} for ${article.slug}]`;
          regenCache.set(cacheKey, newImageUrl);
        }
      }

      if (APPLY) {
        // getNextPostingSlot reads pin_queue to find unoccupied slots, so
        // each iteration naturally pushes the next pin to a later time.
        // When the lookahead window fills, it falls back to now+72h — the
        // post-pins cron's MAX_PINS_PER_DAY cap will pace these regardless.
        const slot = await getNextPostingSlot();
        await db
          .update(pinQueue)
          .set({
            status: "pending",
            imageUrl: newImageUrl,
            scheduledAt: slot,
            retryCount: 0,
            failureReason: null,
          })
          .where(eq(pinQueue.id, pin.id));

        console.log(`  ✓ ${label}  →  ${slot.toISOString().slice(0, 16)}`);
      } else {
        console.log(`  ◦ ${label}  (would regen + requeue)`);
      }

      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${label}  failed: ${msg}`);
      skipped++;
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("\n" + "─".repeat(70));
  console.log(
    `${APPLY ? "Applied" : "Would apply"}: ${processed} | Skipped: ${skipped} | Unique designs regen'd: ${regenCache.size} | ${elapsed}s`,
  );

  // Optional cleanup of duplicate failed rows
  if (CLEAN_DUPES && duplicates.length > 0) {
    if (APPLY) {
      const ids = duplicates.map((d) => d.pin.id);
      // Delete in chunks of 200 to keep the query reasonable
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        await db.delete(pinQueue).where(inArray(pinQueue.id, chunk));
      }
      console.log(`\nDeleted ${duplicates.length} duplicate failed rows.`);
    } else {
      console.log(`\nWould delete ${duplicates.length} duplicate failed rows (with --apply).`);
    }
  }

  if (!APPLY) {
    console.log("\nRe-run with --apply to actually mutate the DB.");
    console.log("Add --clean-dupes to also delete duplicate failed rows.");
  } else {
    console.log("\nNext: the post-pins cron (every 15 min, 7am–11pm) will start");
    console.log("posting these, capped at MAX_PINS_PER_DAY (default 40/day).");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
