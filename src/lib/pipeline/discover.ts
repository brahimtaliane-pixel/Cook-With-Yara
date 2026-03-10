import { db } from "@/lib/db";
import { keywords } from "@/lib/db/schema";
import { KeywordStatus } from "@/lib/constants";
import { fetchTrendingKeywords, type PinterestTrendKeyword } from "@/lib/services/pinterest";
import { getConfigValue } from "@/lib/pipeline/base";
import { ConfigKeys, PIPELINE_DEFAULTS } from "@/lib/constants";

const FOOD_INDICATORS = [
  "recipe",
  "recipes",
  "cook",
  "cooking",
  "bake",
  "baking",
  "food",
  "meal",
  "dinner",
  "lunch",
  "breakfast",
  "snack",
  "dessert",
  "soup",
  "salad",
  "cake",
  "bread",
  "pasta",
  "chicken",
  "beef",
  "pork",
  "fish",
  "seafood",
  "vegan",
  "vegetarian",
  "healthy",
  "easy",
  "quick",
  "slow cooker",
  "instant pot",
  "air fryer",
  "grilled",
  "roasted",
  "fried",
  "casserole",
  "stew",
  "curry",
  "pizza",
  "sandwich",
  "smoothie",
  "appetizer",
  "side dish",
  "sauce",
  "dip",
  "marinade",
  "pie",
  "cookie",
  "brownies",
  "pancake",
  "waffle",
  "oatmeal",
  "rice",
  "noodle",
  "taco",
  "burrito",
  "stir fry",
];

function isFoodRelated(keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return FOOD_INDICATORS.some((indicator) => lower.includes(indicator));
}

export async function discoverKeywords(): Promise<{ processed: number }> {
  const region = await getConfigValue(
    ConfigKeys.TARGET_REGION,
    PIPELINE_DEFAULTS.TARGET_REGION
  );

  const trendTypes = ["growing", "monthly"] as const;
  let newCount = 0;

  for (const trendType of trendTypes) {
    let trends: PinterestTrendKeyword[];
    try {
      trends = await fetchTrendingKeywords(region, trendType);
    } catch (error) {
      console.error(`Failed to fetch ${trendType} trends:`, error);
      continue;
    }

    const foodTrends = trends.filter((t) => isFoodRelated(t.keyword));

    for (const trend of foodTrends) {
      try {
        // Use week-over-week growth as the trend score
        const trendScore = Math.round(trend.pct_growth_wow * 100);
        await db
          .insert(keywords)
          .values({
            keyword: trend.keyword,
            region,
            trendType,
            pinterestTrendScore: trendScore,
            status: KeywordStatus.NEW,
          })
          .onConflictDoNothing({ target: keywords.keyword });
        newCount++;
      } catch {
        // Duplicate or DB error — skip silently
      }
    }
  }

  return { processed: newCount };
}
