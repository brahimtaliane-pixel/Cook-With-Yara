import { db } from "@/lib/db";
import { pinQueue } from "@/lib/db/schema";
import { getConfigValue } from "@/lib/pipeline/base";
import { ConfigKeys } from "@/lib/constants";
import { and, eq, gte, lt } from "drizzle-orm";

interface PostingSchedule {
  timezone: string;
  hours: number[];
}

const DEFAULT_SCHEDULE: PostingSchedule = {
  timezone: "America/New_York",
  hours: [7, 8, 9, 11, 12, 14, 15, 17, 18, 20],
};

const LOOKAHEAD_DAYS = 3;
const MIN_SPACING_MIN = 1; // absolute minimum spacing between pins

async function getScheduleConfig(): Promise<PostingSchedule> {
  const raw = await getConfigValue(ConfigKeys.PIN_POSTING_SCHEDULE, "");
  if (!raw) return DEFAULT_SCHEDULE;
  try {
    const parsed = JSON.parse(raw) as PostingSchedule;
    if (parsed.timezone && Array.isArray(parsed.hours) && parsed.hours.length > 0) {
      return parsed;
    }
    return DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

/**
 * Calculate how many slots per hour and the spacing between them
 * based on daily target and number of posting hours.
 *
 * 40 pins / 4 hours = 10 per hour, 6 min apart
 * 40 pins / 10 hours = 4 per hour, 15 min apart
 * 40 pins / 1 hour = 40 per hour, 1.5 min apart (clamped to 1 min)
 */
function calculateSlotParams(dailyTarget: number, hourCount: number): {
  slotsPerHour: number;
  spacingMin: number;
} {
  const slotsPerHour = Math.ceil(dailyTarget / hourCount);
  const spacingMin = Math.max(MIN_SPACING_MIN, Math.floor(60 / slotsPerHour));
  return { slotsPerHour, spacingMin };
}

/** Get the hour in the target timezone for a given Date */
function getHourInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(date), 10);
}

/** Get the start of a given date in a specific timezone */
function getDatePartsInTimezone(
  date: Date,
  timezone: string
): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find((p) => p.type === "year")!.value, 10),
    month: parseInt(parts.find((p) => p.type === "month")!.value, 10),
    day: parseInt(parts.find((p) => p.type === "day")!.value, 10),
  };
}

/** Build a UTC Date for a specific hour in the target timezone on a given date */
function buildSlotDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minuteOffset: number,
  timezone: string
): Date {
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minuteOffset).padStart(2, "0")}:00`;

  const tempDate = new Date(dateStr + "Z");
  const utcFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const tzFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const utcParts = utcFormatter.formatToParts(tempDate);
  const tzParts = tzFormatter.formatToParts(tempDate);

  const utcHour = parseInt(utcParts.find((p) => p.type === "hour")!.value, 10);
  const utcMin = parseInt(utcParts.find((p) => p.type === "minute")!.value, 10);
  const tzHour = parseInt(tzParts.find((p) => p.type === "hour")!.value, 10);
  const tzMin = parseInt(tzParts.find((p) => p.type === "minute")!.value, 10);

  const utcTotal = utcHour * 60 + utcMin;
  const tzTotal = tzHour * 60 + tzMin;
  const offsetMinutes = utcTotal - tzTotal;

  const slotUtc = new Date(dateStr + "Z");
  slotUtc.setMinutes(slotUtc.getMinutes() + offsetMinutes);
  return slotUtc;
}

interface GetNextSlotOptions {
  afterSlot?: Date;
}

/**
 * Finds the next available posting slot.
 *
 * Dynamically calculates slots per hour based on:
 *   daily pin target ÷ number of posting hours
 *
 * So if you set 40 pins/day and pick 4 hours, you get 10 slots/hour
 * spaced 6 min apart. If you pick 1 hour, 40 slots spaced ~1 min apart.
 * The hours control WHEN, the daily target controls HOW MANY.
 */
export async function getNextPostingSlot(
  options?: GetNextSlotOptions
): Promise<Date> {
  const schedule = await getScheduleConfig();
  const dailyTarget = parseInt(
    await getConfigValue(ConfigKeys.MAX_PINS_PER_DAY, "40"),
    10
  );
  const now = new Date();

  const { slotsPerHour, spacingMin } = calculateSlotParams(
    dailyTarget,
    schedule.hours.length
  );

  // Minimum time: either now or afterSlot + 4 hours
  const minTime = options?.afterSlot
    ? new Date(options.afterSlot.getTime() + 4 * 60 * 60 * 1000)
    : now;

  // Look ahead up to LOOKAHEAD_DAYS
  const maxTime = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  // Get all pending/posting pins in the lookahead window
  const occupiedPins = await db
    .select({ scheduledAt: pinQueue.scheduledAt })
    .from(pinQueue)
    .where(
      and(
        gte(pinQueue.scheduledAt, now),
        lt(pinQueue.scheduledAt, maxTime),
        eq(pinQueue.status, "pending")
      )
    );

  const occupiedSlots = new Set(
    occupiedPins.map((p) => p.scheduledAt.getTime())
  );

  // Iterate through days and configured hours to find available slots
  const sortedHours = [...schedule.hours].sort((a, b) => a - b);

  for (let dayOffset = 0; dayOffset <= LOOKAHEAD_DAYS; dayOffset++) {
    const checkDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const { year, month, day } = getDatePartsInTimezone(checkDate, schedule.timezone);

    for (const hour of sortedHours) {
      for (let slotIdx = 0; slotIdx < slotsPerHour; slotIdx++) {
        const minuteOffset = slotIdx * spacingMin;
        if (minuteOffset >= 60) break; // safety: don't overflow into next hour
        const slotDate = buildSlotDate(year, month, day, hour, minuteOffset, schedule.timezone);

        // Must be in the future and after minTime
        if (slotDate <= minTime) continue;
        if (slotDate > maxTime) continue;

        // Check if this slot is free
        if (!occupiedSlots.has(slotDate.getTime())) {
          return slotDate;
        }
      }
    }
  }

  // Fallback: 72 hours from now
  console.log("[schedule] All slots full for next 3 days, using 72h fallback");
  return new Date(now.getTime() + 72 * 60 * 60 * 1000);
}
