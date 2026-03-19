import { db } from "@/lib/db";
import { intelCompetitors, intelPins } from "@/lib/db/schema";
import { desc, eq, gte, and, isNotNull, count, avg, sum, sql } from "drizzle-orm";
import { IntelTabs } from "./intel-tabs";
import { computePinScore } from "@/lib/services/intel-scoring";
import type { IntelStats } from "./stats-bar";

export const dynamic = "force-dynamic";

export default async function IntelPage() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [
    competitors,
    trendingPins,
    [totalRow],
    [weekRow],
    [avgVelRow],
    topDomainRows,
    [compRow],
    [pipelineRow],
    [totalSavesRow],
  ] = await Promise.all([
    db
      .select()
      .from(intelCompetitors)
      .orderBy(desc(intelCompetitors.createdAt)),
    db
      .select()
      .from(intelPins)
      .where(and(isNotNull(intelPins.pinCreatedAt), gte(intelPins.pinCreatedAt, monthAgo)))
      .orderBy(desc(intelPins.velocity))
      .limit(500),
    db.select({ value: count() }).from(intelPins),
    db
      .select({ value: count() })
      .from(intelPins)
      .where(gte(intelPins.discoveredAt, weekAgo)),
    db
      .select({ value: avg(intelPins.velocity) })
      .from(intelPins)
      .where(gte(intelPins.velocity, 1)),
    db
      .select({
        domain: intelPins.domain,
        cnt: count(),
      })
      .from(intelPins)
      .where(sql`${intelPins.domain} != ''`)
      .groupBy(intelPins.domain)
      .orderBy(desc(count()))
      .limit(1),
    db
      .select({ value: count() })
      .from(intelCompetitors)
      .where(eq(intelCompetitors.isActive, true)),
    db
      .select({ value: count() })
      .from(intelPins)
      .where(eq(intelPins.sentToPipeline, true)),
    db
      .select({ value: sum(intelPins.saves) })
      .from(intelPins),
  ]);

  // Compute scores for each trending pin
  const scoredPins = trendingPins.map((pin) => {
    const { score, tier, tierColor } = computePinScore({
      saves: pin.saves,
      velocity: pin.velocity,
      instantVelocity: pin.instantVelocity,
      acceleration: pin.acceleration,
      baselineMultiple: pin.baselineMultiple,
      pinCreatedAt: pin.pinCreatedAt,
      creatorFollowers: pin.creatorFollowers,
      title: pin.title,
      description: pin.description,
    });
    return { ...pin, trendScore: score, scoreTier: tier, scoreTierColor: tierColor };
  });

  // Sort by score descending
  scoredPins.sort((a, b) => b.trendScore - a.trendScore);

  const recommendedCount = scoredPins.filter((p) => p.trendScore >= 70).length;

  const stats: IntelStats = {
    totalPins: totalRow?.value ?? 0,
    avgVelocity: Number(avgVelRow?.value ?? 0),
    topDomain: topDomainRows[0]?.domain ?? null,
    thisWeekPins: weekRow?.value ?? 0,
    activeCompetitors: compRow?.value ?? 0,
    pipelineRate: pipelineRow?.value ?? 0,
    totalForRate: totalRow?.value ?? 0,
    totalSaves: Number(totalSavesRow?.value ?? 0),
    recommendedCount,
  };

  return (
    <IntelTabs
      competitors={competitors}
      trendingPins={scoredPins}
      stats={stats}
    />
  );
}
