import { db } from "@/lib/db";
import { keywords, articles } from "@/lib/db/schema";
import { KeywordStatus, FOOD_INDICATORS, FOOD_BLOCKLIST } from "@/lib/constants";
import { fetchTrendingKeywords, type PinterestTrendKeyword } from "@/lib/services/pinterest";
import { getConfigValue } from "@/lib/pipeline/base";
import { ConfigKeys, PIPELINE_DEFAULTS } from "@/lib/constants";
import { generateSlug } from "@/lib/utils/slug";
import { sql } from "drizzle-orm";

// --- Food detection ---

function isFoodRelated(keyword: string): boolean {
  const lower = keyword.toLowerCase();
  if (FOOD_BLOCKLIST.some((blocked) => lower.includes(blocked))) return false;
  return FOOD_INDICATORS.some((indicator) => lower.includes(indicator));
}

// --- Spike scoring ---
// Combines wow, mom, yoy growth into a single score that heavily
// weights week-over-week spikes (the "trending RIGHT NOW" signal).

function computeTrendScore(trend: PinterestTrendKeyword): number {
  const wow = trend.pct_growth_wow ?? 0;  // week-over-week (most important)
  const mom = trend.pct_growth_mom ?? 0;  // month-over-month
  const yoy = trend.pct_growth_yoy ?? 0;  // year-over-year

  // WoW is 3x weight — a keyword spiking this week is our #1 signal
  // MoM adds confirmation of sustained growth
  // YoY is a tiebreaker for seasonal relevance
  return Math.round((wow * 3 + mom * 1.5 + yoy * 0.5) * 100);
}

// --- Duplicate detection ---
// Checks if we already have this keyword or a very similar slug in
// the keywords table or articles table so we don't write duplicates.

async function isDuplicate(keyword: string): Promise<boolean> {
  const slug = generateSlug(keyword);

  // Check if exact keyword already exists
  const [existingKeyword] = await db
    .select({ id: keywords.id })
    .from(keywords)
    .where(sql`${keywords.keyword} = ${keyword}`)
    .limit(1);

  if (existingKeyword) return true;

  // Check if an article with the same slug already exists
  const [existingArticle] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(sql`${articles.slug} = ${slug}`)
    .limit(1);

  return !!existingArticle;
}

// --- Main discovery ---

export async function discoverKeywords(): Promise<{ processed: number }> {
  const region = await getConfigValue(
    ConfigKeys.TARGET_REGION,
    PIPELINE_DEFAULTS.TARGET_REGION
  );

  // Fetch all three trend types in parallel for speed
  const trendTypes = ["growing", "monthly", "yearly"] as const;
  const trendResults = await Promise.allSettled(
    trendTypes.map((type) => fetchTrendingKeywords(region, type))
  );

  // Merge all trends, tag with their source type
  const allTrends: { trend: PinterestTrendKeyword; trendType: string }[] = [];

  trendResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      for (const trend of result.value) {
        allTrends.push({ trend, trendType: trendTypes[i] });
      }
    } else {
      console.error(`Failed to fetch ${trendTypes[i]} trends:`, result.reason);
    }
  });

  // Filter to food-related, deduplicate by keyword, keep highest score
  const seen = new Map<string, { trend: PinterestTrendKeyword; trendType: string; score: number }>();

  for (const { trend, trendType } of allTrends) {
    if (!isFoodRelated(trend.keyword)) continue;

    const score = computeTrendScore(trend);
    const existing = seen.get(trend.keyword);

    if (!existing || score > existing.score) {
      seen.set(trend.keyword, { trend, trendType, score });
    }
  }

  // Sort by score descending — highest spikes first
  const ranked = [...seen.values()].sort((a, b) => b.score - a.score);

  let newCount = 0;

  for (const { trend, trendType, score } of ranked) {
    // Skip keywords that slug to "" — they break Blob paths downstream
    if (!generateSlug(trend.keyword)) continue;

    // Skip duplicates we've already written about
    if (await isDuplicate(trend.keyword)) continue;

    try {
      await db
        .insert(keywords)
        .values({
          keyword: trend.keyword,
          region,
          trendType,
          pinterestTrendScore: score,
          status: KeywordStatus.NEW,
        })
        .onConflictDoNothing({ target: keywords.keyword });
      newCount++;
    } catch {
      // Duplicate or DB error — skip silently
    }
  }

  return { processed: newCount };
}
