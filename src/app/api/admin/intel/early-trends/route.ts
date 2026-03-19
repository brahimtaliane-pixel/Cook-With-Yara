import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins, intelCompetitors } from "@/lib/db/schema";
import { eq, desc, gte, and, lt, type SQL } from "drizzle-orm";
import { computePinScore } from "@/lib/services/intel-scoring";

export async function GET() {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const conditions: SQL[] = [
    gte(intelPins.acceleration, 5),
    lt(intelPins.saves, 500),
    eq(intelPins.trendDirection, "rising"),
    gte(intelPins.pinCreatedAt, fourteenDaysAgo),
  ];

  const rows = await db
    .select({
      id: intelPins.id,
      pinId: intelPins.pinId,
      competitorId: intelPins.competitorId,
      competitorUsername: intelCompetitors.username,
      title: intelPins.title,
      description: intelPins.description,
      imageUrl: intelPins.imageUrl,
      linkUrl: intelPins.linkUrl,
      domain: intelPins.domain,
      saves: intelPins.saves,
      repins: intelPins.repins,
      velocity: intelPins.velocity,
      instantVelocity: intelPins.instantVelocity,
      acceleration: intelPins.acceleration,
      baselineMultiple: intelPins.baselineMultiple,
      trendDirection: intelPins.trendDirection,
      creatorName: intelPins.creatorName,
      creatorFollowers: intelPins.creatorFollowers,
      boardName: intelPins.boardName,
      pinCreatedAt: intelPins.pinCreatedAt,
      source: intelPins.source,
      sentToPipeline: intelPins.sentToPipeline,
      discoveredAt: intelPins.discoveredAt,
    })
    .from(intelPins)
    .leftJoin(intelCompetitors, eq(intelPins.competitorId, intelCompetitors.id))
    .where(and(...conditions))
    .orderBy(desc(intelPins.acceleration))
    .limit(200);

  const scored = rows.map((row) => {
    const { score, tier, tierColor } = computePinScore({
      saves: row.saves,
      velocity: row.velocity,
      instantVelocity: row.instantVelocity,
      acceleration: row.acceleration,
      baselineMultiple: row.baselineMultiple,
      pinCreatedAt: row.pinCreatedAt,
      creatorFollowers: row.creatorFollowers,
      title: row.title,
      description: row.description,
    });
    return { ...row, trendScore: score, scoreTier: tier, scoreTierColor: tierColor };
  });

  // Sort by acceleration descending, take top 50
  scored.sort((a, b) => b.acceleration - a.acceleration);
  const top50 = scored.slice(0, 50);

  const totalRising = scored.length;
  const avgAcceleration =
    totalRising > 0
      ? Math.round(scored.reduce((sum, p) => sum + p.acceleration, 0) / totalRising)
      : 0;
  const topAccelerating = top50[0] ?? null;

  return NextResponse.json({
    pins: top50,
    summary: {
      totalRising,
      avgAcceleration,
      topAcceleratingTitle: topAccelerating?.title ?? null,
      topAcceleration: topAccelerating?.acceleration ?? 0,
    },
  });
}
