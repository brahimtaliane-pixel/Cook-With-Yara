/**
 * One-time backfill: re-enrich all intel_pins where saves == repins
 * to get the correct aggregated_stats.saves from the Widget API.
 *
 * Usage: npx tsx scripts/backfill-saves.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import { intelPins } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { enrichPinsViaWidget, computeVelocity } from "@/lib/services/pinterest-intel";

async function main() {
  // Find all pins where saves == repins (stale data)
  const stale = await db
    .select({ id: intelPins.id, pinId: intelPins.pinId })
    .from(intelPins)
    .where(sql`${intelPins.saves} = ${intelPins.repins} AND ${intelPins.saves} > 0`);

  console.log(`Found ${stale.length} pins to backfill`);

  const batchSize = 50;
  let updated = 0;

  for (let i = 0; i < stale.length; i += batchSize) {
    const batch = stale.slice(i, i + batchSize);
    const pinIds = batch.map((p) => p.pinId);

    const enriched = await enrichPinsViaWidget(pinIds);

    for (const pin of batch) {
      const data = enriched.get(pin.pinId);
      if (!data) continue;

      // Only update if saves and repins are now different
      if (data.saves !== data.repins) {
        const velocity = computeVelocity(data.saves, data.createdAt);
        await db
          .update(intelPins)
          .set({
            saves: data.saves,
            repins: data.repins,
            velocity,
            creatorFollowers: data.creatorFollowers,
            lastEnrichedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(intelPins.id, pin.id));
        updated++;
      }
    }

    console.log(`Processed ${Math.min(i + batchSize, stale.length)}/${stale.length} (${updated} updated)`);
  }

  console.log(`Done. Updated ${updated} pins with correct saves/repins.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
