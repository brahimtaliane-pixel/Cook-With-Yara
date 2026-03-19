import { db } from "@/lib/db";
import { intelPins } from "@/lib/db/schema";
import { gte, and, isNotNull, desc, count, sql } from "drizzle-orm";
import { computePinScore } from "@/lib/services/intel-scoring";

async function main() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Get all pins from the last 7 days
  const weekPins = await db
    .select()
    .from(intelPins)
    .where(and(isNotNull(intelPins.pinCreatedAt), gte(intelPins.pinCreatedAt, weekAgo)))
    .orderBy(desc(intelPins.saves));

  console.log(`Total pins from last 7 days: ${weekPins.length}\n`);

  // Distribution of saves
  const savesDistribution = {
    "0 saves": 0,
    "1-5 saves": 0,
    "6-20 saves": 0,
    "21-100 saves": 0,
    "101-500 saves": 0,
    "500+ saves": 0,
  };
  for (const p of weekPins) {
    if (p.saves === 0) savesDistribution["0 saves"]++;
    else if (p.saves <= 5) savesDistribution["1-5 saves"]++;
    else if (p.saves <= 20) savesDistribution["6-20 saves"]++;
    else if (p.saves <= 100) savesDistribution["21-100 saves"]++;
    else if (p.saves <= 500) savesDistribution["101-500 saves"]++;
    else savesDistribution["500+ saves"]++;
  }
  console.log("Saves distribution (last 7 days):");
  for (const [range, cnt] of Object.entries(savesDistribution)) {
    console.log(`  ${range}: ${cnt} pins`);
  }

  // Show the scoring for some low-save pins
  console.log("\n--- LOW SAVE PINS (1-5 saves) with their scores ---");
  const lowSavePins = weekPins.filter((p) => p.saves >= 1 && p.saves <= 5);
  for (const p of lowSavePins.slice(0, 10)) {
    const daysOld = p.pinCreatedAt
      ? Math.round((Date.now() - new Date(p.pinCreatedAt).getTime()) / 86400000 * 10) / 10
      : null;
    const score = computePinScore({
      saves: p.saves,
      velocity: p.velocity,
      instantVelocity: p.instantVelocity,
      acceleration: p.acceleration,
      baselineMultiple: p.baselineMultiple / 10,
      pinCreatedAt: p.pinCreatedAt,
      creatorFollowers: p.creatorFollowers,
      title: p.title,
      description: p.description,
    });
    console.log(`  Score=${score.score} (${score.tier}) | ${p.saves} saves | vel=${p.velocity} | instVel=${p.instantVelocity} | accel=${p.acceleration} | baseline=${p.baselineMultiple/10}x | ${daysOld}d old | ${p.source} | "${p.title?.slice(0, 50)}"`);
  }

  // Show top scored pins from the week
  console.log("\n--- TOP 15 SCORED PINS (last 7 days) ---");
  const scored = weekPins.map((p) => {
    const s = computePinScore({
      saves: p.saves,
      velocity: p.velocity,
      instantVelocity: p.instantVelocity,
      acceleration: p.acceleration,
      baselineMultiple: p.baselineMultiple / 10,
      pinCreatedAt: p.pinCreatedAt,
      creatorFollowers: p.creatorFollowers,
      title: p.title,
      description: p.description,
    });
    return { ...p, ...s };
  });
  scored.sort((a, b) => b.score - a.score);

  for (const p of scored.slice(0, 15)) {
    const daysOld = p.pinCreatedAt
      ? Math.round((Date.now() - new Date(p.pinCreatedAt).getTime()) / 86400000 * 10) / 10
      : null;
    console.log(`  Score=${p.score} (${p.tier}) | ${p.saves} saves | vel=${p.velocity} | instVel=${p.instantVelocity} | accel=${p.acceleration} | baseline=${p.baselineMultiple/10}x | ${daysOld}d old | ${p.source} | "${p.title?.slice(0, 60)}"`);
  }

  // Check: how many pins have instantVelocity/acceleration computed?
  const [computed] = await db.select({
    withInstVel: count(sql`CASE WHEN ${intelPins.instantVelocity} > 0 THEN 1 END`),
    withAccel: count(sql`CASE WHEN ${intelPins.acceleration} != 0 THEN 1 END`),
    withBaseline: count(sql`CASE WHEN ${intelPins.baselineMultiple} > 0 THEN 1 END`),
    total: count(),
  }).from(intelPins);

  console.log("\n--- METRICS COVERAGE ---");
  console.log(`  Total pins: ${computed.total}`);
  console.log(`  With instantVelocity > 0: ${computed.withInstVel}`);
  console.log(`  With acceleration != 0: ${computed.withAccel}`);
  console.log(`  With baselineMultiple > 0: ${computed.withBaseline}`);

  process.exit(0);
}
main();
