import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins } from "@/lib/db/schema";
import {
  searchPinterestViaApify,
  enrichPinsViaWidget,
  computeVelocity,
} from "@/lib/services/pinterest-intel";

export async function POST(request: Request) {
  const body = (await request.json()) as { query: string; limit?: number };

  if (!body.query) {
    return NextResponse.json(
      { error: "query is required" },
      { status: 400 }
    );
  }

  const results = await searchPinterestViaApify(body.query, body.limit ?? 25);

  if (results.length === 0) {
    return NextResponse.json([]);
  }

  // Enrich with widget API
  const pinIds = results.map((p) => p.pinId);
  const enriched = await enrichPinsViaWidget(pinIds);

  const pins = [];

  for (const pin of results) {
    const widgetData = enriched.get(pin.pinId);
    const saves = widgetData?.saves ?? 0;
    const pinCreatedAt = widgetData?.createdAt
      ? new Date(widgetData.createdAt)
      : pin.publishedAt
        ? new Date(pin.publishedAt)
        : null;
    const velocity = computeVelocity(saves, pinCreatedAt);

    const [inserted] = await db
      .insert(intelPins)
      .values({
        pinId: pin.pinId,
        title: widgetData?.title || pin.title,
        description: widgetData?.description || pin.description,
        imageUrl: widgetData?.imageUrl || pin.imageUrl,
        linkUrl: pin.linkUrl,
        domain: widgetData?.domain || "",
        saves,
        repins: widgetData?.repins ?? 0,
        velocity,
        creatorName: widgetData?.creatorName || "",
        creatorFollowers: widgetData?.creatorFollowers ?? 0,
        boardName: widgetData?.boardName || "",
        pinCreatedAt,
        source: "search",
        lastEnrichedAt: widgetData ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: intelPins.pinId,
        set: {
          title: widgetData?.title || pin.title,
          description: widgetData?.description || pin.description,
          imageUrl: widgetData?.imageUrl || pin.imageUrl,
          saves,
          repins: widgetData?.repins ?? 0,
          velocity,
          creatorName: widgetData?.creatorName || "",
          creatorFollowers: widgetData?.creatorFollowers ?? 0,
          boardName: widgetData?.boardName || "",
          domain: widgetData?.domain || "",
          lastEnrichedAt: widgetData ? new Date() : null,
          updatedAt: new Date(),
        },
      })
      .returning();

    pins.push(inserted);
  }

  return NextResponse.json(pins);
}
