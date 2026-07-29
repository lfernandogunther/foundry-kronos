import { getCalendarLabels, type CalendarLabels } from "./calendar.js";
import { dayOfYear } from "./gregorian.js";

/**
 * The only file that touches PF2e internals.
 *
 * `game.pf2e.worldClock` and `CONFIG.PF2E.worldClock` are system implementation details, not a
 * public API, so every read here is feature-detected with a working fallback. If the system
 * changes shape, this file is the only one that needs attention.
 *
 * The conversion PF2e performs is: world creation timestamp + `worldTime` seconds, read in UTC,
 * with a fixed offset added to the year. Reproducing that formula — rather than reading the
 * system's already-formatted output — is what lets us convert *arbitrary* times, which the jump
 * and step controls need.
 */

const MS_PER_SECOND = 1000;

export interface WorldDate {
  /** The `game.time.worldTime` value this was derived from. */
  worldTime: number;
  /** Absolute UTC milliseconds, for arithmetic. */
  utcMs: number;
  /** Displayed year, era offset applied. */
  year: number;
  /** Underlying Gregorian year, before the offset. */
  gregorianYear: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0-6, 0 = the Monday-equivalent weekday. */
  weekdayIndex: number;
  /** 1-366 */
  dayOfYear: number;
  monthName: string;
  weekdayName: string;
  era: string;
}

let warnedMissingCreatedOn = false;

/**
 * When PF2e is absent or its setting is unreadable we still need *some* origin, or every date
 * becomes NaN. The Unix epoch is an arbitrary but stable choice; the warning makes clear the
 * displayed date is not authoritative.
 */
function fallbackCreatedOnMs(): number {
  if (!warnedMissingCreatedOn) {
    warnedMissingCreatedOn = true;
    console.warn(
      "pf2e-calendar-bar | could not read the PF2e world creation date; dates will not match the system World Clock",
    );
  }
  return 0;
}

/** Reads PF2e's world creation timestamp, accepting each shape the setting has plausibly taken. */
export function getWorldCreatedOnMs(): number {
  let raw: unknown;
  try {
    raw = game.settings.get("pf2e", "worldClock.worldCreatedOn");
  } catch {
    return fallbackCreatedOnMs();
  }

  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? fallbackCreatedOnMs() : parsed;
  }
  if (typeof raw === "number") return raw;
  if (raw instanceof Date) return raw.getTime();

  // Luxon DateTime, should the system ever hand one back directly.
  const asLuxon = raw as { toMillis?: () => number } | null;
  if (asLuxon && typeof asLuxon.toMillis === "function") return asLuxon.toMillis();

  return fallbackCreatedOnMs();
}

export function worldTimeToUtcMs(worldTime: number): number {
  return getWorldCreatedOnMs() + worldTime * MS_PER_SECOND;
}

/** Inverse of {@link worldTimeToUtcMs}, for turning a target instant into a `game.time.advance` delta. */
export function utcMsToWorldTime(utcMs: number): number {
  return Math.round((utcMs - getWorldCreatedOnMs()) / MS_PER_SECOND);
}

export function describeUtcMs(utcMs: number, labels: CalendarLabels, worldTime: number): WorldDate {
  const d = new Date(utcMs);
  const gregorianYear = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;

  // getUTCDay() is 0-based on Sunday; the calendar's weekday list starts on the Monday-equivalent.
  const weekdayIndex = (d.getUTCDay() + 6) % 7;

  return {
    worldTime,
    utcMs,
    year: gregorianYear + labels.yearOffset,
    gregorianYear,
    month,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekdayIndex,
    dayOfYear: dayOfYear(utcMs),
    monthName: labels.months[month - 1] ?? String(month),
    weekdayName: labels.weekdays[weekdayIndex] ?? String(weekdayIndex),
    era: labels.era,
  };
}

export function getWorldDate(worldTime: number = game.time.worldTime): WorldDate {
  return describeUtcMs(worldTimeToUtcMs(worldTime), getCalendarLabels(), worldTime);
}

/** Stable key for "which in-world day is it", used to decide when weather should be regenerated. */
export function dateKeyOf(date: WorldDate): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.gregorianYear}-${mm}-${dd}`;
}

/**
 * Compares our reconstruction against the system's own clock and reports any disagreement.
 *
 * The whole point of reproducing PF2e's formula is that the two never diverge, so a mismatch is
 * a real defect worth surfacing loudly rather than a cosmetic difference.
 */
export function verifyAgainstSystemClock(): { agrees: boolean; detail: string } {
  const systemClock = game.pf2e?.worldClock;
  const systemTime = systemClock?.worldTime;
  if (!systemTime || typeof systemTime.toMillis !== "function") {
    return { agrees: true, detail: "system World Clock unavailable; nothing to compare against" };
  }

  const ours = worldTimeToUtcMs(game.time.worldTime);
  const theirs = systemTime.toMillis();
  const driftSeconds = Math.abs(ours - theirs) / MS_PER_SECOND;

  // Sub-second drift is just rounding between the two representations.
  if (driftSeconds < 1) return { agrees: true, detail: "matches the system World Clock" };

  const detail = `disagrees with the system World Clock by ${Math.round(driftSeconds)}s (ours ${new Date(ours).toISOString()}, system ${new Date(theirs).toISOString()})`;
  console.warn(`pf2e-calendar-bar | ${detail}`);
  return { agrees: false, detail };
}
