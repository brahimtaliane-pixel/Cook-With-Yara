import { db } from "@/lib/db";
import { intelPins } from "@/lib/db/schema";
import { eq, gte, and, isNotNull, count } from "drizzle-orm";

async function main() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // All pins from last 7 days
  const [allWeek] = await db.select({ count: count() }).from(intelPins)
    .where(and(isNotNull(intelPins.pinCreatedAt), gte(intelPins.pinCreatedAt, weekAgo)));
  console.log(`All pins from last 7 days: ${allWeek.count}`);

  // Trending source only (what the UI fetches)
  const [trendingWeek] = await db.select({ count: count() }).from(intelPins)
    .where(and(
      eq(intelPins.source, "trending"),
      isNotNull(intelPins.pinCreatedAt),
      gte(intelPins.pinCreatedAt, weekAgo),
    ));
  console.log(`Trending pins from last 7 days: ${trendingWeek.count}`);

  // Resource-api source (competitor pins)
  const [competitorWeek] = await db.select({ count: count() }).from(intelPins)
    .where(and(
      eq(intelPins.source, "resource-api"),
      isNotNull(intelPins.pinCreatedAt),
      gte(intelPins.pinCreatedAt, weekAgo),
    ));
  console.log(`Competitor pins from last 7 days: ${competitorWeek.count}`);

  // All trending pins (no date filter)
  const [allTrending] = await db.select({ count: count() }).from(intelPins)
    .where(eq(intelPins.source, "trending"));
  console.log(`\nAll trending pins (any date): ${allTrending.count}`);

  // All competitor pins
  const [allCompetitor] = await db.select({ count: count() }).from(intelPins)
    .where(eq(intelPins.source, "resource-api"));
  console.log(`All competitor pins (any date): ${allCompetitor.count}`);

  process.exit(0);
}
main();
