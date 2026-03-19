import { db } from "@/lib/db";
import { intelPins } from "@/lib/db/schema";
import { eq, gte, and, isNotNull, isNull, count, sql } from "drizzle-orm";

async function main() {
  // Total pins
  const [total] = await db.select({ count: count() }).from(intelPins);
  console.log(`Total pins: ${total.count}`);

  // Pins with null pinCreatedAt
  const [nullDates] = await db.select({ count: count() }).from(intelPins).where(isNull(intelPins.pinCreatedAt));
  console.log(`Pins with NULL pinCreatedAt: ${nullDates.count}`);

  // Pins older than 30 days
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const [oldPins] = await db.select({ count: count() }).from(intelPins)
    .where(and(isNotNull(intelPins.pinCreatedAt), gte(intelPins.pinCreatedAt, monthAgo)));
  console.log(`Pins from last 30 days (with pinCreatedAt): ${oldPins.count}`);

  // Pins older than 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [weekPins] = await db.select({ count: count() }).from(intelPins)
    .where(and(isNotNull(intelPins.pinCreatedAt), gte(intelPins.pinCreatedAt, weekAgo)));
  console.log(`Pins from last 7 days (with pinCreatedAt): ${weekPins.count}`);

  // Show oldest pins to see what's leaking through
  const oldest = await db.select({
    pinId: intelPins.pinId,
    title: intelPins.title,
    pinCreatedAt: intelPins.pinCreatedAt,
    source: intelPins.source,
    velocity: intelPins.velocity,
  }).from(intelPins)
    .where(isNotNull(intelPins.pinCreatedAt))
    .orderBy(intelPins.pinCreatedAt)
    .limit(5);

  console.log("\nOldest 5 pins (by pinCreatedAt):");
  for (const p of oldest) {
    const daysOld = Math.round((Date.now() - new Date(p.pinCreatedAt!).getTime()) / 86400000);
    console.log(`  ${daysOld}d ago | vel=${p.velocity} | src=${p.source} | ${p.title?.slice(0, 50)}`);
  }

  // Show some trending pins with source="trending" that are old
  const oldTrending = await db.select({
    pinId: intelPins.pinId,
    title: intelPins.title,
    pinCreatedAt: intelPins.pinCreatedAt,
    source: intelPins.source,
    velocity: intelPins.velocity,
    saves: intelPins.saves,
  }).from(intelPins)
    .where(and(
      eq(intelPins.source, "trending"),
      isNotNull(intelPins.pinCreatedAt),
    ))
    .orderBy(intelPins.pinCreatedAt)
    .limit(10);

  console.log("\nOldest 10 trending pins:");
  for (const p of oldTrending) {
    const daysOld = Math.round((Date.now() - new Date(p.pinCreatedAt!).getTime()) / 86400000);
    console.log(`  ${daysOld}d ago | vel=${p.velocity} | saves=${p.saves} | ${p.title?.slice(0, 60)}`);
  }

  process.exit(0);
}
main();
