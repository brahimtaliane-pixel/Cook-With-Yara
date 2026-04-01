import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelCompetitors, intelPins, intelPinSnapshots, autopilotDecisions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    displayName?: string;
    isActive?: boolean;
  };

  const updates: Record<string, unknown> = {};

  if (typeof body.displayName === "string") {
    updates.displayName = body.displayName;
  }
  if (typeof body.isActive === "boolean") {
    updates.isActive = body.isActive;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(intelCompetitors)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(intelCompetitors.id, id))
    .returning({ id: intelCompetitors.id });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Delete autopilot decisions referencing this competitor's pins
  await db.delete(autopilotDecisions).where(
    sql`${autopilotDecisions.intelPinId} IN (
      SELECT ${intelPins.id} FROM ${intelPins}
      WHERE ${intelPins.competitorId} = ${id}
    )`
  );

  // Delete snapshots for this competitor's pins
  await db.delete(intelPinSnapshots).where(
    sql`${intelPinSnapshots.pinId} IN (
      SELECT ${intelPins.pinId} FROM ${intelPins}
      WHERE ${intelPins.competitorId} = ${id}
    )`
  );

  // Delete the competitor's pins
  await db.delete(intelPins).where(eq(intelPins.competitorId, id));

  // Delete the competitor
  const [deleted] = await db
    .delete(intelCompetitors)
    .where(eq(intelCompetitors.id, id))
    .returning({ id: intelCompetitors.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
