import { db } from "@/lib/db";
import { intelCompetitors, intelPins, intelPinSnapshots } from "@/lib/db/schema";
import { eq, desc, avg, lt, inArray, isNull } from "drizzle-orm";
import {
  scrapeCompetitorProfileViaApify,
  searchPinterestNative,
  computeVelocity,
  checkRepinStatus,
  fetchTrendingTopics,
  type EnrichedPin,
} from "@/lib/services/pinterest-intel";
import {
  TRENDING_RECIPE_QUERIES,
  INTEL_DEFAULTS,
  FOOD_INDICATORS,
  FOOD_BLOCKLIST,
} from "@/lib/constants";

// Batch size for parallel DB upserts
const DB_BATCH_SIZE = 25;

// Non-food domains that frequently pollute search results
const NON_FOOD_DOMAINS = [
  "walmart.com", "depop.com", "etsy.com", "amazon.com", "ebay.com",
  "target.com", "aliexpress.com", "shein.com", "temu.com", "wish.com",
  "mercari.com", "poshmark.com", "redbubble.com", "society6.com",
];

// Terms that indicate a non-food pin (toys, crafts, fashion, etc.)
// If ANY of these appear, the pin is rejected unless it has a strong food signal
const NON_FOOD_TERMS = [
  "squishy", "squishies", "fidget", "toy", "toys", "needoh", "unboxing",
  "gift wish", "wish list", "mystery box", "five below", "fivebelow",
  "learning express", "blind bag", "glitter dumpling", "plastic",
  "crochet", "amigurumi", "keychain", "earring", "jewelry", "nail art",
  "outfit", "ootd", "haul", "room decor", "wallpaper", "aesthetic room",
];

// Strong food signals that override non-food term matches
const STRONG_FOOD_SIGNALS = [
  "recipe", "recipes", "cook", "cooking", "bake", "baking",
  "ingredient", "tablespoon", "teaspoon", "preheat", "oven",
  "minutes", "serve", "servings", "calories", "prep time",
];

/**
 * Check if a pin is food/recipe related based on its text content.
 * Returns true if the pin has food indicators and no blocklist hits.
 */
function isFoodRelatedPin(pin: EnrichedPin): boolean {
  const text = `${pin.title} ${pin.description} ${pin.boardName}`.toLowerCase();

  // Reject if it matches the blocklist (non-halal)
  if (FOOD_BLOCKLIST.some((term) => text.includes(term))) return false;

  // Reject if from a known non-food retail domain
  const domain = pin.domain.toLowerCase();
  if (NON_FOOD_DOMAINS.some((d) => domain.includes(d))) return false;

  // If non-food terms are present, only allow if there's a strong food signal
  const hasNonFoodTerm = NON_FOOD_TERMS.some((term) => text.includes(term));
  if (hasNonFoodTerm) {
    return STRONG_FOOD_SIGNALS.some((term) => text.includes(term));
  }

  // Count how many food indicators match
  const foodHits = FOOD_INDICATORS.filter((term) => text.includes(term)).length;

  // Pins with no source domain (user uploads) are often crafts/toys — require 2+ food hits
  const isUserUpload = !pin.domain || pin.domain === "";
  if (isUserUpload && foodHits < 2) return false;

  return foodHits > 0;
}

// === Snapshot Functions ===

async function createSnapshots(competitorId: string): Promise<void> {
  const pins = await db
    .select({
      pinId: intelPins.pinId,
      saves: intelPins.saves,
      repins: intelPins.repins,
      velocity: intelPins.velocity,
    })
    .from(intelPins)
    .where(eq(intelPins.competitorId, competitorId));

  if (pins.length === 0) return;

  const now = new Date();
  for (let i = 0; i < pins.length; i += 50) {
    const batch = pins.slice(i, i + 50);
    await db.insert(intelPinSnapshots).values(
      batch.map((p) => ({
        pinId: p.pinId,
        saves: p.saves,
        repins: p.repins,
        velocity: p.velocity,
        snapshotAt: now,
      }))
    );
  }
}

async function computeInstantMetrics(competitorId: string): Promise<void> {
  const pins = await db
    .select({
      id: intelPins.id,
      pinId: intelPins.pinId,
      saves: intelPins.saves,
      velocity: intelPins.velocity,
    })
    .from(intelPins)
    .where(eq(intelPins.competitorId, competitorId));

  if (pins.length === 0) return;

  // Fetch all snapshots for these pins in one query, ordered by recency
  const pinIds = pins.map((p) => p.pinId);
  const allSnapshots = await db
    .select()
    .from(intelPinSnapshots)
    .where(inArray(intelPinSnapshots.pinId, pinIds))
    .orderBy(desc(intelPinSnapshots.snapshotAt));

  // Group snapshots by pinId (already sorted desc by snapshotAt)
  const snapshotsByPin = new Map<string, typeof allSnapshots>();
  for (const snap of allSnapshots) {
    const existing = snapshotsByPin.get(snap.pinId);
    if (existing) {
      existing.push(snap);
    } else {
      snapshotsByPin.set(snap.pinId, [snap]);
    }
  }

  // Compute metrics in memory
  const now = new Date();
  type UpdateEntry = {
    id: string;
    instantVelocity: number;
    acceleration: number;
    trendDirection: string;
    previousSaves: number;
    previousSnapshotAt: Date;
  };
  const updates: UpdateEntry[] = [];

  for (const pin of pins) {
    const snapshots = snapshotsByPin.get(pin.pinId) ?? [];

    if (snapshots.length < 2) {
      updates.push({
        id: pin.id,
        instantVelocity: pin.velocity,
        acceleration: 0,
        trendDirection: "new",
        previousSaves: pin.saves,
        previousSnapshotAt: now,
      });
      continue;
    }

    // Use the two most recent snapshots for instantVelocity
    const [latest, previous] = snapshots;
    const daysBetweenLatest = Math.max(
      0.1,
      (latest.snapshotAt.getTime() - previous.snapshotAt.getTime()) / 86_400_000
    );
    const instantVelocity = Math.max(
      0,
      Math.round((latest.saves - previous.saves) / daysBetweenLatest)
    );

    // For acceleration, need a third snapshot to compare velocity intervals
    let acceleration = 0;
    if (snapshots.length >= 3) {
      const third = snapshots[2];
      const daysBetweenPrev = Math.max(
        0.1,
        (previous.snapshotAt.getTime() - third.snapshotAt.getTime()) / 86_400_000
      );
      const prevVelocity = Math.max(
        0,
        Math.round((previous.saves - third.saves) / daysBetweenPrev)
      );
      acceleration = instantVelocity - prevVelocity;
    }

    let trendDirection = "stable";
    if (acceleration > 5) trendDirection = "rising";
    else if (acceleration < -5) trendDirection = "falling";

    updates.push({
      id: pin.id,
      instantVelocity,
      acceleration,
      trendDirection,
      previousSaves: previous.saves,
      previousSnapshotAt: previous.snapshotAt,
    });
  }

  // Batch updates in groups of 50
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await Promise.all(
      batch.map((u) =>
        db
          .update(intelPins)
          .set({
            instantVelocity: u.instantVelocity,
            acceleration: u.acceleration,
            trendDirection: u.trendDirection,
            previousSaves: u.previousSaves,
            previousSnapshotAt: u.previousSnapshotAt,
          })
          .where(eq(intelPins.id, u.id))
      )
    );
  }
}

async function computeCreatorBaselines(competitorId: string): Promise<void> {
  const [result] = await db
    .select({
      avgVelocity: avg(intelPins.velocity),
    })
    .from(intelPins)
    .where(eq(intelPins.competitorId, competitorId));

  const creatorAvgVelocity = Number(result?.avgVelocity ?? 0);
  if (creatorAvgVelocity <= 0) return;

  const pins = await db
    .select({
      id: intelPins.id,
      instantVelocity: intelPins.instantVelocity,
    })
    .from(intelPins)
    .where(eq(intelPins.competitorId, competitorId));

  // Compute all multiples in memory, then batch update
  const updates = pins.map((pin) => ({
    id: pin.id,
    // Store as integer * 10 (so 2.5x = 25)
    baselineMultiple: Math.round((pin.instantVelocity / creatorAvgVelocity) * 10),
  }));

  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await Promise.all(
      batch.map((u) =>
        db
          .update(intelPins)
          .set({ baselineMultiple: u.baselineMultiple })
          .where(eq(intelPins.id, u.id))
      )
    );
  }
}

async function createTrendingSnapshots(): Promise<void> {
  const pins = await db
    .select({
      pinId: intelPins.pinId,
      saves: intelPins.saves,
      repins: intelPins.repins,
      velocity: intelPins.velocity,
    })
    .from(intelPins)
    .where(isNull(intelPins.competitorId));

  if (pins.length === 0) return;

  const now = new Date();
  for (let i = 0; i < pins.length; i += 50) {
    const batch = pins.slice(i, i + 50);
    await db.insert(intelPinSnapshots).values(
      batch.map((p) => ({
        pinId: p.pinId,
        saves: p.saves,
        repins: p.repins,
        velocity: p.velocity,
        snapshotAt: now,
      }))
    );
  }
}

async function computeTrendingInstantMetrics(): Promise<void> {
  const pins = await db
    .select({
      id: intelPins.id,
      pinId: intelPins.pinId,
      saves: intelPins.saves,
      velocity: intelPins.velocity,
    })
    .from(intelPins)
    .where(isNull(intelPins.competitorId));

  if (pins.length === 0) return;

  const pinIds = pins.map((p) => p.pinId);
  const allSnapshots = await db
    .select()
    .from(intelPinSnapshots)
    .where(inArray(intelPinSnapshots.pinId, pinIds))
    .orderBy(desc(intelPinSnapshots.snapshotAt));

  const snapshotsByPin = new Map<string, typeof allSnapshots>();
  for (const snap of allSnapshots) {
    const existing = snapshotsByPin.get(snap.pinId);
    if (existing) {
      existing.push(snap);
    } else {
      snapshotsByPin.set(snap.pinId, [snap]);
    }
  }

  const now = new Date();
  type UpdateEntry = {
    id: string;
    instantVelocity: number;
    acceleration: number;
    trendDirection: string;
    previousSaves: number;
    previousSnapshotAt: Date;
  };
  const updates: UpdateEntry[] = [];

  for (const pin of pins) {
    const snapshots = snapshotsByPin.get(pin.pinId) ?? [];

    if (snapshots.length < 2) {
      updates.push({
        id: pin.id,
        instantVelocity: pin.velocity,
        acceleration: 0,
        trendDirection: "new",
        previousSaves: pin.saves,
        previousSnapshotAt: now,
      });
      continue;
    }

    const [latest, previous] = snapshots;
    const daysBetweenLatest = Math.max(
      0.1,
      (latest.snapshotAt.getTime() - previous.snapshotAt.getTime()) / 86_400_000
    );
    const instantVelocity = Math.max(
      0,
      Math.round((latest.saves - previous.saves) / daysBetweenLatest)
    );

    let acceleration = 0;
    if (snapshots.length >= 3) {
      const third = snapshots[2];
      const daysBetweenPrev = Math.max(
        0.1,
        (previous.snapshotAt.getTime() - third.snapshotAt.getTime()) / 86_400_000
      );
      const prevVelocity = Math.max(
        0,
        Math.round((previous.saves - third.saves) / daysBetweenPrev)
      );
      acceleration = instantVelocity - prevVelocity;
    }

    let trendDirection = "stable";
    if (acceleration > 5) trendDirection = "rising";
    else if (acceleration < -5) trendDirection = "falling";

    updates.push({
      id: pin.id,
      instantVelocity,
      acceleration,
      trendDirection,
      previousSaves: previous.saves,
      previousSnapshotAt: previous.snapshotAt,
    });
  }

  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await Promise.all(
      batch.map((u) =>
        db
          .update(intelPins)
          .set({
            instantVelocity: u.instantVelocity,
            acceleration: u.acceleration,
            trendDirection: u.trendDirection,
            previousSaves: u.previousSaves,
            previousSnapshotAt: u.previousSnapshotAt,
          })
          .where(eq(intelPins.id, u.id))
      )
    );
  }
}

async function cleanupOldSnapshots(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  await db
    .delete(intelPinSnapshots)
    .where(lt(intelPinSnapshots.snapshotAt, cutoff));
}

// === Batch upsert for enriched pins (from Apify — already has all data) ===

async function upsertEnrichedPins(
  pins: EnrichedPin[],
  competitorId: string,
  source: string
): Promise<number> {
  if (pins.length === 0) return 0;

  const now = new Date();
  let processed = 0;

  for (let i = 0; i < pins.length; i += DB_BATCH_SIZE) {
    const batch = pins.slice(i, i + DB_BATCH_SIZE);
    const promises = batch.map((pin) =>
      db
        .insert(intelPins)
        .values({
          pinId: pin.pinId,
          competitorId,
          title: pin.title,
          description: pin.description,
          imageUrl: pin.imageUrl,
          linkUrl: pin.linkUrl,
          domain: pin.domain,
          saves: pin.saves,
          repins: pin.repins,
          velocity: pin.velocity,
          creatorName: pin.creatorName,
          creatorFollowers: pin.creatorFollowers,
          boardName: pin.boardName,
          pinCreatedAt: pin.pinCreatedAt,
          source,
          lastEnrichedAt: now,
        })
        .onConflictDoUpdate({
          target: intelPins.pinId,
          set: {
            competitorId, // claim orphaned trending pins
            title: pin.title,
            description: pin.description,
            imageUrl: pin.imageUrl,
            saves: pin.saves,
            repins: pin.repins,
            velocity: pin.velocity,
            creatorName: pin.creatorName,
            creatorFollowers: pin.creatorFollowers,
            boardName: pin.boardName,
            domain: pin.domain,
            lastEnrichedAt: now,
            updatedAt: now,
          },
        })
    );
    await Promise.all(promises);
    processed += batch.length;
  }

  return processed;
}

// === Single competitor refresh (used by both add-competitor and refresh-all) ===

export async function refreshSingleCompetitor(competitorId: string): Promise<number> {
  const [competitor] = await db
    .select()
    .from(intelCompetitors)
    .where(eq(intelCompetitors.id, competitorId))
    .limit(1);

  if (!competitor) return 0;

  // 1. Snapshot current state BEFORE fetching new data
  await createSnapshots(competitorId);

  // 2. Fetch new pin data
  const enrichedPins = await scrapeCompetitorProfileViaApify(
    competitor.username,
    200
  );

  // 3. Filter out repins
  const pinIds = enrichedPins.map((p) => p.pinId);
  const repinIds = await checkRepinStatus(pinIds);
  const filtered = enrichedPins.filter((p) => !repinIds.has(p.pinId));

  if (repinIds.size > 0) {
    console.log(`[intel-refresh] ${competitor.username}: filtered ${repinIds.size}/${enrichedPins.length} repins`);
  }

  const processed = await upsertEnrichedPins(
    filtered,
    competitor.id,
    "resource-api"
  );

  // 4. Compute instant metrics from snapshots
  await computeInstantMetrics(competitorId);

  // 5. Compute creator baselines
  await computeCreatorBaselines(competitorId);

  await db
    .update(intelCompetitors)
    .set({ lastFetchedAt: new Date(), updatedAt: new Date() })
    .where(eq(intelCompetitors.id, competitor.id));

  console.log(
    `[intel-refresh] ${competitor.username}: ${processed} pins processed`
  );

  return processed;
}

// === Refresh all competitors ===

export async function refreshAllCompetitors(): Promise<{ processed: number }> {
  const competitors = await db
    .select({ id: intelCompetitors.id })
    .from(intelCompetitors)
    .where(eq(intelCompetitors.isActive, true));

  let totalProcessed = 0;

  // Process competitors one at a time to avoid rate limiting
  for (const competitor of competitors) {
    try {
      const processed = await refreshSingleCompetitor(competitor.id);
      totalProcessed += processed;
    } catch (error) {
      console.error(
        `[intel-refresh] Failed for competitor ${competitor.id}:`,
        error
      );
    }
  }

  return { processed: totalProcessed };
}

// === Trending pins refresh ===

export async function refreshTrendingPins(): Promise<{ processed: number }> {
  let totalProcessed = 0;

  // 1. Snapshot existing trending pins BEFORE fetching new data
  await createTrendingSnapshots();

  // 2. Get queries: Pinterest Trends API → fallback to static list
  const trendingTopics = await fetchTrendingTopics();

  let queries: string[];
  if (trendingTopics.length > 0) {
    queries = trendingTopics
      .slice(0, INTEL_DEFAULTS.QUERIES_PER_REFRESH)
      .map((t) => t.keyword);
    console.log(`[intel-trending] Using ${queries.length} Pinterest Trends topics`);
  } else {
    const shuffled = [...TRENDING_RECIPE_QUERIES].sort(() => Math.random() - 0.5);
    queries = shuffled.slice(0, INTEL_DEFAULTS.QUERIES_PER_REFRESH);
    console.log(`[intel-trending] Falling back to static queries`);
  }

  // Deduplicate across queries — same pin can appear in multiple searches
  const seenPinIds = new Set<string>();

  // 3. Search + enrich via native Pinterest APIs (no Apify)
  for (const query of queries) {
    try {
      const pins = await searchPinterestNative(
        query,
        INTEL_DEFAULTS.TRENDING_PINS_PER_QUERY,
      );

      if (pins.length === 0) {
        console.log(`[intel-trending] No results for "${query}"`);
        continue;
      }

      // Deduplicate: skip pins already seen in earlier queries
      const dedupedPins = pins.filter((p) => !seenPinIds.has(p.pinId));
      for (const p of dedupedPins) seenPinIds.add(p.pinId);

      // Filter to food/recipe pins only (Trends keywords like "dumpling" match toys too)
      const newPins = dedupedPins.filter(isFoodRelatedPin);
      if (newPins.length < dedupedPins.length) {
        console.log(`[intel-trending] "${query}": filtered ${dedupedPins.length - newPins.length}/${dedupedPins.length} non-food pins`);
      }

      const now = new Date();

      // Upsert to DB
      for (let i = 0; i < newPins.length; i += DB_BATCH_SIZE) {
        const batch = newPins.slice(i, i + DB_BATCH_SIZE);
        await Promise.all(
          batch.map((pin) =>
            db
              .insert(intelPins)
              .values({
                pinId: pin.pinId,
                title: pin.title,
                description: pin.description,
                imageUrl: pin.imageUrl,
                linkUrl: pin.linkUrl,
                domain: pin.domain,
                saves: pin.saves,
                repins: pin.repins,
                velocity: pin.velocity,
                creatorName: pin.creatorName,
                creatorFollowers: pin.creatorFollowers,
                boardName: pin.boardName,
                pinCreatedAt: pin.pinCreatedAt,
                source: "trending",
                lastEnrichedAt: now,
              })
              .onConflictDoUpdate({
                target: intelPins.pinId,
                set: {
                  title: pin.title,
                  description: pin.description,
                  imageUrl: pin.imageUrl,
                  saves: pin.saves,
                  repins: pin.repins,
                  velocity: pin.velocity,
                  creatorName: pin.creatorName,
                  creatorFollowers: pin.creatorFollowers,
                  boardName: pin.boardName,
                  domain: pin.domain,
                  source: "trending",
                  lastEnrichedAt: now,
                  updatedAt: now,
                },
              }),
          ),
        );
        totalProcessed += batch.length;
      }

      const topSaves = newPins.slice(0, 3).map((p) => p.saves);
      console.log(
        `[intel-trending] "${query}": ${newPins.length} pins stored (top saves: ${topSaves.join(", ")})`,
      );
    } catch (error) {
      console.error(`[intel-trending] Failed for query "${query}":`, error);
    }
  }

  // 4. Compute instant metrics for trending pins after all upserts
  await computeTrendingInstantMetrics();

  return { processed: totalProcessed };
}

export async function refreshAll(): Promise<{ processed: number }> {
  const competitors = await refreshAllCompetitors();
  const trending = await refreshTrendingPins();

  // Clean up old snapshots
  await cleanupOldSnapshots();

  return { processed: competitors.processed + trending.processed };
}
