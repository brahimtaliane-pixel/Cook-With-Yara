import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pinQueue, pipelineConfig } from "@/lib/db/schema";
import { and, eq, gte, lt, desc, asc, sql } from "drizzle-orm";
import { ConfigKeys } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();

  // EST timezone offset: UTC-5 (or UTC-4 during DST)
  // Use America/New_York for correct DST handling
  const estNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const todayStart = new Date(estNow);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // Convert EST boundaries back to UTC for DB queries
  const estOffset = now.getTime() - estNow.getTime();
  const todayStartUTC = new Date(todayStart.getTime() + estOffset);
  const yesterdayStartUTC = new Date(yesterdayStart.getTime() + estOffset);

  const [todayPins, yesterdayPins, upcomingPins, failedPins, hourlyRows, configRow] =
    await Promise.all([
      // Today's posted pins
      db
        .select()
        .from(pinQueue)
        .where(
          and(
            eq(pinQueue.status, "posted"),
            gte(pinQueue.postedAt, todayStartUTC)
          )
        )
        .orderBy(desc(pinQueue.postedAt)),

      // Yesterday's posted pins
      db
        .select()
        .from(pinQueue)
        .where(
          and(
            eq(pinQueue.status, "posted"),
            gte(pinQueue.postedAt, yesterdayStartUTC),
            lt(pinQueue.postedAt, todayStartUTC)
          )
        )
        .orderBy(desc(pinQueue.postedAt)),

      // Upcoming pending pins
      db
        .select()
        .from(pinQueue)
        .where(
          and(
            eq(pinQueue.status, "pending"),
            gte(pinQueue.scheduledAt, now)
          )
        )
        .orderBy(asc(pinQueue.scheduledAt))
        .limit(50),

      // Failed pins
      db
        .select()
        .from(pinQueue)
        .where(eq(pinQueue.status, "failed"))
        .orderBy(desc(pinQueue.createdAt))
        .limit(20),

      // Hourly breakdown for today (in EST)
      db
        .select({
          hour: sql<number>`extract(hour from ${pinQueue.postedAt} at time zone 'America/New_York')::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(pinQueue)
        .where(
          and(
            eq(pinQueue.status, "posted"),
            gte(pinQueue.postedAt, todayStartUTC)
          )
        )
        .groupBy(
          sql`extract(hour from ${pinQueue.postedAt} at time zone 'America/New_York')`
        )
        .orderBy(
          sql`extract(hour from ${pinQueue.postedAt} at time zone 'America/New_York')`
        ),

      // Daily target from config
      db
        .select({ value: pipelineConfig.value })
        .from(pipelineConfig)
        .where(eq(pipelineConfig.key, ConfigKeys.MAX_PINS_PER_DAY))
        .limit(1),
    ]);

  const dailyTarget = configRow.length > 0 ? parseInt(configRow[0].value, 10) : 40;

  // Build hourly breakdown as full 24h array
  const hourlyBreakdown = Array.from({ length: 24 }, (_, i) => {
    const match = hourlyRows.find((r) => r.hour === i);
    return { hour: i, count: match ? match.count : 0 };
  });

  return NextResponse.json({
    todayPins,
    yesterdayPins,
    upcomingPins,
    failedPins,
    hourlyBreakdown,
    dailyTarget,
  }, {
    headers: {
      "Cache-Control": "private, max-age=0, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
