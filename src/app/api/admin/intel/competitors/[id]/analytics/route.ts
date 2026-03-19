import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins, intelCompetitors } from "@/lib/db/schema";
import { eq, and, gte, isNotNull, sql, count, sum, avg, desc } from "drizzle-orm";
import { computePinScore } from "@/lib/services/intel-scoring";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "all";

  // Verify competitor exists
  const [competitor] = await db
    .select({ id: intelCompetitors.id })
    .from(intelCompetitors)
    .where(eq(intelCompetitors.id, id))
    .limit(1);

  if (!competitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build date filter
  const conditions = [eq(intelPins.competitorId, id)];
  if (period === "today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    conditions.push(isNotNull(intelPins.pinCreatedAt));
    conditions.push(gte(intelPins.pinCreatedAt, todayStart));
  } else if (period === "week") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    conditions.push(isNotNull(intelPins.pinCreatedAt));
    conditions.push(gte(intelPins.pinCreatedAt, weekAgo));
  } else if (period === "month") {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    conditions.push(isNotNull(intelPins.pinCreatedAt));
    conditions.push(gte(intelPins.pinCreatedAt, monthAgo));
  }

  const where = and(...conditions);

  // Run all aggregates in parallel
  const [summaryRows, allPins, domainRows, boardRows, frequencyRows] =
    await Promise.all([
      // Summary KPIs
      db
        .select({
          totalPins: count(),
          totalSaves: sum(intelPins.saves),
          totalRepins: sum(intelPins.repins),
          avgSaves: avg(intelPins.saves),
          avgVelocity: avg(intelPins.velocity),
          pipelineCount: count(
            sql`CASE WHEN ${intelPins.sentToPipeline} = true THEN 1 END`
          ),
        })
        .from(intelPins)
        .where(where),

      // All pins for score computation + top pins + themes
      db
        .select({
          id: intelPins.id,
          pinId: intelPins.pinId,
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
        .where(where),

      // Domain breakdown
      db
        .select({
          domain: intelPins.domain,
          count: count(),
          totalSaves: sum(intelPins.saves),
          avgSaves: avg(intelPins.saves),
        })
        .from(intelPins)
        .where(where)
        .groupBy(intelPins.domain)
        .orderBy(desc(count()))
        .limit(15),

      // Board breakdown
      db
        .select({
          boardName: intelPins.boardName,
          count: count(),
          totalSaves: sum(intelPins.saves),
          avgVelocity: avg(intelPins.velocity),
        })
        .from(intelPins)
        .where(where)
        .groupBy(intelPins.boardName)
        .orderBy(desc(count()))
        .limit(15),

      // Posting frequency
      period === "week"
        ? db
            .select({
              period: sql<string>`to_char(${intelPins.pinCreatedAt}, 'YYYY-MM-DD')`,
              count: count(),
              totalSaves: sum(intelPins.saves),
            })
            .from(intelPins)
            .where(where)
            .groupBy(
              sql`to_char(${intelPins.pinCreatedAt}, 'YYYY-MM-DD')`
            )
            .orderBy(
              sql`to_char(${intelPins.pinCreatedAt}, 'YYYY-MM-DD')`
            )
        : period === "month"
          ? db
              .select({
                period: sql<string>`to_char(${intelPins.pinCreatedAt}, 'IYYY-IW')`,
                count: count(),
                totalSaves: sum(intelPins.saves),
              })
              .from(intelPins)
              .where(where)
              .groupBy(
                sql`to_char(${intelPins.pinCreatedAt}, 'IYYY-IW')`
              )
              .orderBy(
                sql`to_char(${intelPins.pinCreatedAt}, 'IYYY-IW')`
              )
          : db
              .select({
                period: sql<string>`to_char(${intelPins.pinCreatedAt}, 'YYYY-MM')`,
                count: count(),
                totalSaves: sum(intelPins.saves),
              })
              .from(intelPins)
              .where(where)
              .groupBy(
                sql`to_char(${intelPins.pinCreatedAt}, 'YYYY-MM')`
              )
              .orderBy(
                sql`to_char(${intelPins.pinCreatedAt}, 'YYYY-MM')`
              ),
    ]);

  const summary = summaryRows[0];

  // Compute scores for all pins
  const scored = allPins.map((pin) => {
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

  // Score tier distribution
  const tierDistribution = [
    { tier: "Must Write", color: "emerald", count: 0 },
    { tier: "Strong", color: "blue", count: 0 },
    { tier: "Promising", color: "amber", count: 0 },
    { tier: "Watch", color: "yellow", count: 0 },
    { tier: "Low Priority", color: "muted", count: 0 },
  ];
  for (const pin of scored) {
    const bucket = tierDistribution.find((t) => t.tier === pin.scoreTier);
    if (bucket) bucket.count++;
  }

  // Top pins sorted by score, limited to 100
  const topPins = [...scored]
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 100);

  // Avg score
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + p.trendScore, 0) / scored.length)
      : 0;

  // Board breakdown with top score
  const boardMap = new Map<
    string,
    { count: number; totalSaves: number; avgVelocity: number; topScore: number; topTier: string; topTierColor: string }
  >();
  for (const pin of scored) {
    const name = pin.boardName || "(no board)";
    const existing = boardMap.get(name);
    if (!existing) {
      boardMap.set(name, {
        count: 1,
        totalSaves: pin.saves,
        avgVelocity: pin.velocity,
        topScore: pin.trendScore,
        topTier: pin.scoreTier,
        topTierColor: pin.scoreTierColor,
      });
    } else {
      existing.count++;
      existing.totalSaves += pin.saves;
      existing.avgVelocity =
        (existing.avgVelocity * (existing.count - 1) + pin.velocity) / existing.count;
      if (pin.trendScore > existing.topScore) {
        existing.topScore = pin.trendScore;
        existing.topTier = pin.scoreTier;
        existing.topTierColor = pin.scoreTierColor;
      }
    }
  }
  const boards = [...boardMap.entries()]
    .map(([boardName, data]) => ({
      boardName,
      ...data,
      avgVelocity: Math.round(data.avgVelocity * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Content themes — bigram extraction
  const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "this", "that", "are", "was",
    "be", "has", "had", "have", "will", "can", "do", "does", "did", "not",
    "so", "if", "my", "your", "our", "no", "its", "how", "you", "i", "we",
    "they", "he", "she", "just", "up", "out", "all", "get", "one", "me",
    "what", "when", "more", "make", "like", "over", "such", "new", "also",
    "than", "into", "any", "only", "very", "these", "some", "other",
  ]);

  const bigramCounts = new Map<string, { count: number; totalScore: number; example: string }>();
  for (const pin of scored) {
    if (!pin.title) continue;
    const words = pin.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    const seen = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (seen.has(bigram)) continue;
      seen.add(bigram);
      const existing = bigramCounts.get(bigram);
      if (!existing) {
        bigramCounts.set(bigram, { count: 1, totalScore: pin.trendScore, example: pin.title });
      } else {
        existing.count++;
        existing.totalScore += pin.trendScore;
      }
    }
  }

  const themes = [...bigramCounts.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([theme, v]) => ({
      theme,
      count: v.count,
      avgScore: Math.round(v.totalScore / v.count),
      example: v.example,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Format frequency rows
  const frequency = frequencyRows
    .filter((r) => r.period)
    .map((r) => ({
      period: r.period,
      count: Number(r.count),
      totalSaves: Number(r.totalSaves ?? 0),
    }));

  // Trend breakdown
  const trendBreakdown = {
    rising: scored.filter((p) => p.trendDirection === "rising").length,
    stable: scored.filter((p) => p.trendDirection === "stable").length,
    falling: scored.filter((p) => p.trendDirection === "falling").length,
    new: scored.filter((p) => p.trendDirection === "new").length,
  };

  const avgAcceleration =
    scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + p.acceleration, 0) / scored.length)
      : 0;

  return NextResponse.json({
    summary: {
      totalPins: Number(summary.totalPins),
      totalSaves: Number(summary.totalSaves ?? 0),
      totalRepins: Number(summary.totalRepins ?? 0),
      avgSaves: Math.round(Number(summary.avgSaves ?? 0)),
      avgVelocity: Math.round(Number(summary.avgVelocity ?? 0) * 10) / 10,
      avgScore,
      avgAcceleration,
      risingCount: trendBreakdown.rising,
      pipelineRate: Number(summary.pipelineCount),
    },
    tierDistribution,
    trendBreakdown,
    topPins,
    domains: domainRows.map((d) => ({
      domain: d.domain || "(none)",
      count: Number(d.count),
      totalSaves: Number(d.totalSaves ?? 0),
      avgSaves: Math.round(Number(d.avgSaves ?? 0)),
    })),
    boards,
    frequency,
    themes,
  });
}
