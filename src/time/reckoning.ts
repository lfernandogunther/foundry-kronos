import type { CalendarDefinition } from "./calendar.js";

/**
 * Date arithmetic for a calendar that owns its month lengths.
 *
 * Pure, and deliberately ignorant of Foundry, PF2e and `Date`: everything here is integer
 * arithmetic on a day count, so it can be tested a year at a time without a fake clock. The anchor
 * arrives already resolved to a world time, which is the one thing this file cannot work out for
 * itself.
 *
 * Years are numbered continuously with no gap at zero. A homebrew reckoning has no need for the
 * BC/AD discontinuity, and skipping it would make every year-crossing calculation a special case.
 */

const SECONDS_PER_DAY = 86_400;

/**
 * JavaScript's `%` keeps the sign of the dividend, so a plain `n % 7` on a day before the anchor
 * returns a negative index and the weekday cycle runs backwards. Every cyclic value here goes
 * through this instead.
 */
function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** The anchor instant, resolved to world time by whoever knows how to read the world's clock. */
export interface EpochAnchor {
  /** World time the anchor instant sits at. */
  worldTime: number;
  /** Seconds into its day that instant reads as. Preserving it preserves the clock's hands. */
  secondsIntoDay: number;
  /** Weekday index of the anchor's day. Preserving it preserves the day of the week. */
  weekdayIndex: number;
}

/** A calendar plus its resolved anchor: everything needed to turn a world time into a date. */
export interface Reckoning {
  monthDays: readonly number[];
  weekdayCount: number;
  daysInYear: number;
  anchorWorldTime: number;
  anchorSecondsIntoDay: number;
  anchorAbsoluteDay: number;
  anchorWeekdayIndex: number;
}

export interface FixedDate {
  year: number;
  /** 1-based. */
  month: number;
  /** 1-based. */
  day: number;
  /** 1-based, 1 on the first day of the year. */
  dayOfYear: number;
  /** 0-based, 0 = the Monday-equivalent weekday. */
  weekdayIndex: number;
  secondsIntoDay: number;
}

/** 1 on the first day of month 1; the year's length on its last day. */
export function dayOfYearOf(monthDays: readonly number[], month: number, day: number): number {
  let total = day;
  for (let index = 0; index < month - 1; index += 1) total += monthDays[index]!;
  return total;
}

export function monthDayOf(monthDays: readonly number[], dayOfYear: number): { month: number; day: number } {
  let remaining = dayOfYear;
  for (let index = 0; index < monthDays.length; index += 1) {
    const length = monthDays[index]!;
    if (remaining <= length) return { month: index + 1, day: remaining };
    remaining -= length;
  }
  // Only reachable for a day beyond the year, which callers derive rather than supply.
  const last = monthDays.length;
  return { month: last, day: monthDays[last - 1]! };
}

/**
 * Days elapsed since the first day of year 1, which is day zero. Negative for earlier dates, which
 * is what makes years before the anchor work without a special case.
 */
function absoluteDayOf(reckoning: Reckoning, year: number, month: number, day: number): number {
  return (year - 1) * reckoning.daysInYear + dayOfYearOf(reckoning.monthDays, month, day) - 1;
}

/**
 * @throws if the calendar borrows the Gregorian structure — there is nothing to reckon from, and a
 * silently wrong date is worse than a stack trace at load.
 */
export function makeReckoning(calendar: CalendarDefinition, anchor: EpochAnchor): Reckoning {
  if (calendar.monthDays === null) {
    throw new Error(`calendar "${calendar.name}" has no month lengths of its own to reckon from`);
  }

  const epoch = calendar.epoch ?? { on: null, year: 1, month: 1, day: 1 };
  const partial: Reckoning = {
    monthDays: calendar.monthDays,
    weekdayCount: calendar.weekdays.length,
    daysInYear: calendar.monthDays.reduce((total, days) => total + days, 0),
    anchorWorldTime: anchor.worldTime,
    anchorSecondsIntoDay: anchor.secondsIntoDay,
    anchorAbsoluteDay: 0,
    anchorWeekdayIndex: anchor.weekdayIndex,
  };

  return { ...partial, anchorAbsoluteDay: absoluteDayOf(partial, epoch.year, epoch.month, epoch.day) };
}

export function describeWorldTime(reckoning: Reckoning, worldTime: number): FixedDate {
  // Measured from the anchor's own position within its day, so the anchor instant reports the
  // anchor date at the anchor's time of day rather than at midnight.
  const total = reckoning.anchorSecondsIntoDay + (worldTime - reckoning.anchorWorldTime);
  const dayDelta = Math.floor(total / SECONDS_PER_DAY);

  const absoluteDay = reckoning.anchorAbsoluteDay + dayDelta;
  const yearIndex = Math.floor(absoluteDay / reckoning.daysInYear);
  const dayOfYear = absoluteDay - yearIndex * reckoning.daysInYear + 1;
  const { month, day } = monthDayOf(reckoning.monthDays, dayOfYear);

  return {
    year: yearIndex + 1,
    month,
    day,
    dayOfYear,
    weekdayIndex: mod(reckoning.anchorWeekdayIndex + dayDelta, reckoning.weekdayCount),
    secondsIntoDay: total - dayDelta * SECONDS_PER_DAY,
  };
}

/** Inverse of {@link describeWorldTime}, for resolving a target date back into a world time. */
export function worldTimeAt(
  reckoning: Reckoning,
  year: number,
  month: number,
  day: number,
  secondsIntoDay: number,
): number {
  const dayDelta = absoluteDayOf(reckoning, year, month, day) - reckoning.anchorAbsoluteDay;
  const anchorMidnight = reckoning.anchorWorldTime - reckoning.anchorSecondsIntoDay;
  return anchorMidnight + dayDelta * SECONDS_PER_DAY + secondsIntoDay;
}

/** The world time this day began at. */
export function startOfDay(reckoning: Reckoning, worldTime: number): number {
  return worldTime - describeWorldTime(reckoning, worldTime).secondsIntoDay;
}

/**
 * Add whole months, clamping the day into the target month rather than spilling past its end — the
 * last day of a 31-day month plus one month is the last day of a 30-day one, never the 1st of the
 * month after.
 */
export function addMonths(reckoning: Reckoning, worldTime: number, count: number): number {
  const current = describeWorldTime(reckoning, worldTime);
  const monthCount = reckoning.monthDays.length;

  const shifted = current.month - 1 + count;
  const month = mod(shifted, monthCount) + 1;
  const year = current.year + Math.floor(shifted / monthCount);

  return worldTimeAt(
    reckoning,
    year,
    month,
    Math.min(current.day, reckoning.monthDays[month - 1]!),
    current.secondsIntoDay,
  );
}

/** Years clamp for the same reason months do, and a year is however many months the calendar has. */
export function addYears(reckoning: Reckoning, worldTime: number, count: number): number {
  return addMonths(reckoning, worldTime, count * reckoning.monthDays.length);
}
