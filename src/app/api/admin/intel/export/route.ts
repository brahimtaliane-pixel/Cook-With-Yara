import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins, intelCompetitors } from "@/lib/db/schema";
import { eq, desc, gte, and, isNotNull, type SQL } from "drizzle-orm";
import { computePinScore } from "@/lib/services/intel-scoring";

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const competitorId = searchParams.get("competitorId");
  const minSaves = searchParams.get("minSaves");
  const minScore = searchParams.get("minScore");
  const period = searchParams.get("period");
  const sort = searchParams.get("sort") || "score";

  const conditions: SQL[] = [];

  if (competitorId) {
    conditions.push(eq(intelPins.competitorId, competitorId));
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
    case "date":
      orderBy = desc(intelPins.discoveredAt);
      break;
    case "score":
    default:
      orderBy = desc(intelPins.velocity);
      break;
  }

  const baseQuery = db
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
      competitorUsername: intelCompetitors.username,
    })
    .from(intelPins)
    .leftJoin(intelCompetitors, eq(intelPins.competitorId, intelCompetitors.id))
    .orderBy(orderBy);

  const rows =
    conditions.length > 0
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;

  // Compute scores
  const scored = rows.map((row) => {
    const daysOld = row.pinCreatedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(row.pinCreatedAt).getTime()) / 86_400_000))
      : null;
    const { score, tier } = computePinScore({
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
    return { ...row, trendScore: score, scoreTier: tier, daysOld };
  });

  // Apply min score filter
  let filtered = scored;
  if (minScore) {
    const threshold = parseInt(minScore, 10);
    filtered = scored.filter((p) => p.trendScore >= threshold);
  }

  // Sort by score if requested
  if (sort === "score") {
    filtered.sort((a, b) => b.trendScore - a.trendScore);
  }

  // Build CSV
  const headers = [
    "Title",
    "Pin URL",
    "Saves",
    "Repins",
    "Velocity",
    "Instant Velocity",
    "Acceleration",
    "Score",
    "Tier",
    "Creator",
    "Creator Followers",
    "Board",
    "Domain",
    "Pin Created",
    "Days Old",
    "Source",
    "Trend Direction",
    "Baseline Multiple",
  ];

  const csvRows = [headers.join(",")];
  for (const pin of filtered) {
    csvRows.push(
      [
        escapeCSV(pin.title),
        escapeCSV(`https://pinterest.com/pin/${pin.pinId}`),
        pin.saves,
        pin.repins,
        pin.velocity,
        pin.instantVelocity,
        pin.acceleration,
        pin.trendScore,
        escapeCSV(pin.scoreTier),
        escapeCSV(pin.creatorName),
        pin.creatorFollowers ?? 0,
        escapeCSV(pin.boardName),
        escapeCSV(pin.domain),
        escapeCSV(pin.pinCreatedAt ? new Date(pin.pinCreatedAt).toISOString().split("T")[0] : ""),
        pin.daysOld ?? "",
        escapeCSV(pin.source),
        escapeCSV(pin.trendDirection),
        pin.baselineMultiple,
      ].join(",")
    );
  }

  const csv = csvRows.join("\n");
  const filename = `pinterest-intel-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
