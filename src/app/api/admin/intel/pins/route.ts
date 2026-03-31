import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins, intelCompetitors, articles } from "@/lib/db/schema";
import { eq, desc, gte, and, isNotNull, count, type SQL } from "drizzle-orm";
import { computePinScore } from "@/lib/services/intel-scoring";
import { generateSlug } from "@/lib/utils/slug";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const competitorId = searchParams.get("competitorId");
  const source = searchParams.get("source");
  const minSaves = searchParams.get("minSaves");
  const minScore = searchParams.get("minScore");
  const period = searchParams.get("period"); // "week" | "month" | null
  const sort = searchParams.get("sort") || "score";
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const conditions: SQL[] = [];

  if (competitorId) {
    conditions.push(eq(intelPins.competitorId, competitorId));
  }
  if (source) {
    conditions.push(eq(intelPins.source, source));
  }
  if (minSaves) {
    conditions.push(gte(intelPins.saves, parseInt(minSaves, 10)));
  }
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

  // For score sort, fetch more rows so we can sort + filter client-side
  const isScoreSort = sort === "score";
  const fetchLimit = isScoreSort ? 500 : limit;

  let orderBy;
  switch (sort) {
    case "velocity":
      orderBy = desc(intelPins.velocity);
      break;
    case "acceleration":
      orderBy = desc(intelPins.acceleration);
      break;
    case "saves":
      orderBy = desc(intelPins.saves);
      break;
    case "score":
      // Fetch by velocity as a rough proxy, then re-sort by computed score
      orderBy = desc(intelPins.velocity);
      break;
    case "date":
    default:
      orderBy = desc(intelPins.discoveredAt);
      break;
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Run data query and count query in parallel
  const dataQuery = db
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
      pipelineKeywordId: intelPins.pipelineKeywordId,
      lastEnrichedAt: intelPins.lastEnrichedAt,
      discoveredAt: intelPins.discoveredAt,
      updatedAt: intelPins.updatedAt,
    })
    .from(intelPins)
    .leftJoin(intelCompetitors, eq(intelPins.competitorId, intelCompetitors.id))
    .orderBy(orderBy)
    .limit(fetchLimit)
    .offset(offset);

  const countQuery = db
    .select({ value: count() })
    .from(intelPins);

  const [rows, [totalRow]] = await Promise.all([
    whereClause ? dataQuery.where(whereClause) : dataQuery,
    whereClause ? countQuery.where(whereClause) : countQuery,
  ]);

  const total = totalRow?.value ?? 0;

  // Build a set of existing article slugs to detect duplicates
  const existingArticles = await db
    .select({ slug: articles.slug, status: articles.status, publishedUrl: articles.publishedUrl })
    .from(articles);
  const articlesBySlug = new Map(existingArticles.map((a) => [a.slug, a]));

  // Compute scores for each pin
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

  // Filter out pins already in pipeline, already written, or junk data
  let filtered = scored.filter(
    (p) =>
      !p.sentToPipeline &&
      !p.existingArticleStatus &&
      p.title &&
      p.title !== "Pinterest"
  );

  // Apply min score filter
  if (minScore) {
    const threshold = parseInt(minScore, 10);
    filtered = scored.filter((p) => p.trendScore >= threshold);
  }

  // Sort by score if requested
  if (isScoreSort) {
    filtered.sort((a, b) => b.trendScore - a.trendScore);
    filtered = filtered.slice(0, limit);
  }

  return NextResponse.json({ pins: filtered, total, limit, offset });
}
