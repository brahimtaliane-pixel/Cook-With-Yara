import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins, intelPinSnapshots } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pinId: string }> }
) {
  const { pinId } = await params;

  // pinId param is the intel_pins.id (UUID), so look up the pin's text pinId first
  const pin = await db
    .select({ pinId: intelPins.pinId })
    .from(intelPins)
    .where(eq(intelPins.id, pinId))
    .limit(1);

  if (pin.length === 0) {
    return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  }

  const textPinId = pin[0].pinId;

  const snapshots = await db
    .select({
      snapshotAt: intelPinSnapshots.snapshotAt,
      saves: intelPinSnapshots.saves,
      repins: intelPinSnapshots.repins,
      velocity: intelPinSnapshots.velocity,
    })
    .from(intelPinSnapshots)
    .where(eq(intelPinSnapshots.pinId, textPinId))
    .orderBy(asc(intelPinSnapshots.snapshotAt));

  return NextResponse.json(snapshots);
}
