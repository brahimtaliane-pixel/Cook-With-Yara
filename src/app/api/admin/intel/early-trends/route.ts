import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins, intelCompetitors, articles } from "@/lib/db/schema";
import { eq, desc, gte, and, lt, type SQL } from "drizzle-orm";
import { computePinScore } from "@/lib/services/intel-scoring";
import { generateSlug } from "@/lib/utils/slug";

export async function GET() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const conditions: SQL[] = [
    gte(intelPins.acceleration, 1),
    eq(intelPins.trendDirection, "rising"),
    gte(intelPins.pinCreatedAt, thirtyDaysAgo),
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

  // Build article slug map to detect duplicates
  const existingArticles = await db
    .select({ slug: articles.slug, status: articles.status, publishedUrl: articles.publishedUrl })
    .from(articles);
  const articlesBySlug = new Map(existingArticles.map((a) => [a.slug, a]));

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
    const slug = generateSlug(row.title);
    const existing = articlesBySlug.get(slug);
    return {
      ...row,
      trendScore: score,
      scoreTier: tier,
      scoreTierColor: tierColor,
      existingArticleStatus: existing?.status ?? null,
      existingArticleUrl: existing?.publishedUrl ?? null,
    };
  });

  // Filter out pins already in pipeline, already written, or junk
  const fresh = scored.filter(
    (p) =>
      !p.sentToPipeline &&
      !p.existingArticleStatus &&
      p.title &&
      p.title !== "Pinterest"
  );

  // Sort by acceleration descending, take top 50
  fresh.sort((a, b) => b.acceleration - a.acceleration);
  const top50 = fresh.slice(0, 50);

  const totalRising = fresh.length;
  const avgAcceleration =
    totalRising > 0
      ? Math.round(fresh.reduce((sum, p) => sum + p.acceleration, 0) / totalRising)
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
