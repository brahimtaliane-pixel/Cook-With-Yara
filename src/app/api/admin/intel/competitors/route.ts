import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelCompetitors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { refreshSingleCompetitor } from "@/lib/pipeline/intel-refresh";

export const maxDuration = 300;

export async function GET() {
  const rows = await db
    .select()
    .from(intelCompetitors)
    .orderBy(desc(intelCompetitors.createdAt));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    username: string;
    displayName?: string;
  };

  if (!body.username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  // Sanitize username: strip @, slashes, whitespace
  const username = body.username
    .trim()
    .replace(/^@/, "")
    .replace(/\//g, "");

  // Check for existing username
  const [existing] = await db
    .select({ id: intelCompetitors.id })
    .from(intelCompetitors)
    .where(eq(intelCompetitors.username, username))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Competitor already exists" },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(intelCompetitors)
    .values({
      username,
      displayName: body.displayName || username,
    })
    .returning();

  // Auto-fetch pins for the new competitor
  let pinCount = 0;
  try {
    pinCount = await refreshSingleCompetitor(created.id);
  } catch (error) {
    console.error(
      `[add-competitor] Failed to fetch pins for ${body.username}:`,
      error
    );
    // Don't fail the add — the competitor is created, pins can be fetched later
  }

  return NextResponse.json({ ...created, pinsFetched: pinCount });
}
