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

const SLOT_SPACING_MIN = 15;
const MAX_SLOTS_PER_HOUR = 4; // 60 / 15
const LOOKAHEAD_DAYS = 3;

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
  // Create a date string in the target timezone, then convert to UTC
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minuteOffset).padStart(2, "0")}:00`;

  // Use Intl to find the UTC offset for this moment in the timezone
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

  // Apply offset: slot in TZ → UTC
  const slotUtc = new Date(dateStr + "Z");
  slotUtc.setMinutes(slotUtc.getMinutes() + offsetMinutes);
  return slotUtc;
}

interface GetNextSlotOptions {
  afterSlot?: Date;
}

/**
 * Finds the next available posting slot based on configured hours.
 * Spaces pins ~15 min apart within the same hour.
 * options.afterSlot ensures the slot is 4+ hours after a given time.
 */
export async function getNextPostingSlot(
  options?: GetNextSlotOptions
): Promise<Date> {
  const schedule = await getScheduleConfig();
  const now = new Date();

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
      for (let slotIdx = 0; slotIdx < MAX_SLOTS_PER_HOUR; slotIdx++) {
        const minuteOffset = slotIdx * SLOT_SPACING_MIN;
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
