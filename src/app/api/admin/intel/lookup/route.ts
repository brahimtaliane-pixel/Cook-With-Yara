import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins } from "@/lib/db/schema";
import {
  extractPinIdFromUrl,
  enrichPinsViaWidget,
  computeVelocity,
  checkRepinStatus,
  resolveRealPinDate,
} from "@/lib/services/pinterest-intel";

export async function POST(request: Request) {
  const body = (await request.json()) as { url: string };

  if (!body.url) {
    return NextResponse.json(
      { error: "url is required" },
      { status: 400 }
    );
  }

  const pinId = extractPinIdFromUrl(body.url);

  if (!pinId) {
    return NextResponse.json(
      { error: "Could not extract pin ID from URL" },
      { status: 400 }
    );
  }

  const enriched = await enrichPinsViaWidget([pinId]);
  const widgetData = enriched.get(pinId);

  if (!widgetData) {
    return NextResponse.json(
      { error: "Could not fetch pin data from Pinterest" },
      { status: 404 }
    );
  }

  // Check if this pin is a repin
  const repinIds = await checkRepinStatus([pinId]);
  if (repinIds.has(pinId)) {
    return NextResponse.json(
      { error: "This pin is a repin (saved from another creator). Repins are excluded from intel." },
      { status: 422 }
    );
  }

  // Resolve real publish date
  const articleUrl = widgetData.articleLink || "";
  const pinCreatedAt = await resolveRealPinDate(
    widgetData.datePublished,
    widgetData.createdAt,
    articleUrl
  );

  const velocity = computeVelocity(widgetData.saves, pinCreatedAt);

  const [pin] = await db
    .insert(intelPins)
    .values({
      pinId,
      title: widgetData.title || "Untitled",
      description: widgetData.description || "",
      imageUrl: widgetData.imageUrl || "",
      linkUrl: body.url,
      domain: widgetData.domain || "",
      saves: widgetData.saves,
      repins: widgetData.repins,
      velocity,
      creatorName: widgetData.creatorName || "",
      creatorFollowers: widgetData.creatorFollowers ?? 0,
      boardName: widgetData.boardName || "",
      pinCreatedAt,
      source: "lookup",
      lastEnrichedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: intelPins.pinId,
      set: {
        title: widgetData.title || "Untitled",
        description: widgetData.description || "",
        imageUrl: widgetData.imageUrl || "",
        domain: widgetData.domain || "",
        saves: widgetData.saves,
        repins: widgetData.repins,
        velocity,
        creatorName: widgetData.creatorName || "",
        creatorFollowers: widgetData.creatorFollowers ?? 0,
        boardName: widgetData.boardName || "",
        lastEnrichedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json(pin);
}
