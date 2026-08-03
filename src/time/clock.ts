import { MODULE_ID } from "../constants.js";
import { type CalendarDefinition, getCalendar, hasOwnMonths } from "./calendar.js";
import { addMonthsUtc, addYearsUtc, dayOfYear, daysInMonth, daysInYear } from "./gregorian.js";
import { readWorldCreatedOnMs, utcMsToWorldTime, worldTimeToUtcMs } from "./pf2e-clock.js";
import { type Season, seasonOf } from "./season.js";
import {
  addMonths,
  addYears,
  describeWorldTime,
  type EpochAnchor,
  makeReckoning,
  type Reckoning,
  startOfDay,
  worldTimeAt as reckonWorldTimeAt,
} from "./reckoning.js";

/**
 * What time it is, whichever calendar is in force.
 *
 * Two structures produce a date, and everything downstream of here is indifferent to which. The
 * Gregorian one reproduces PF2e's own formula so the two clocks agree; the fixed-length one counts
 * days from the calendar's own anchor and gives that agreement up. Nothing outside this file needs
 * to know the difference.
 */

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export interface WorldDate {
  /** The `game.time.worldTime` value this was derived from. */
  worldTime: number;
  /** Displayed year: the era offset applied for the Gregorian structure, the reckoning's own otherwise. */
  year: number;
  /** 1-based. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Seconds elapsed since this day began. */
  secondsIntoDay: number;
  /** 0-based, 0 = the Monday-equivalent weekday. */
  weekdayIndex: number;
  /** 1-based. */
  dayOfYear: number;
  /** How long the year holding this day is, for the solar and weather curves. */
  daysInYear: number;
  /** Resolved from the calendar's own boundaries, so no caller has to know where they came from. */
  season: Season;
  monthName: string;
  weekdayName: string;
  era: string;
  /**
   * Stable identifier for "which in-world day is it", used to decide when weather should be
   * regenerated and to pin a GM's override to a day. The weather is seeded from it, so the same day
   * must always produce the same string.
   *
   * A calendar with months of its own names itself in it, because its year, month and day mean
   * something different from anyone else's — two such calendars would otherwise hand each other
   * their days. Calendars on the Gregorian timeline deliberately do not: they all agree on which day
   * an instant is, so they agree on its weather, and a world that has been running keeps the weather
   * it has been having.
   */
  dayKey: string;
  /** Named only on the days that carry one. */
  festival: string | null;
}

function dayKeyFor(namespace: string, year: number, month: number, day: number): string {
  const stamp = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return namespace ? `${namespace}:${stamp}` : stamp;
}

function festivalOn(calendar: CalendarDefinition, month: number, day: number): string | null {
  return calendar.festivals.find((entry) => entry.month === month && entry.day === day)?.name ?? null;
}

function named(
  calendar: CalendarDefinition,
  month: number,
  weekdayIndex: number,
): { monthName: string; weekdayName: string } {
  return {
    monthName: calendar.months[month - 1] ?? String(month),
    weekdayName: calendar.weekdays[weekdayIndex] ?? String(weekdayIndex),
  };
}

/**
 * The Gregorian structure: PF2e's conversion, with the months renamed.
 *
 * Exported so it can be tested without a world — the agreement with the system clock is the whole
 * reason this path exists, and it is worth guarding directly.
 */
export function describeGregorian(utcMs: number, calendar: CalendarDefinition, worldTime: number): WorldDate {
  const d = new Date(utcMs);
  const gregorianYear = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;

  // getUTCDay() is 0-based on Sunday; the calendar's weekday list starts on the Monday-equivalent.
  const weekdayIndex = (d.getUTCDay() + 6) % 7;
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const second = d.getUTCSeconds();
  const day = d.getUTCDate();

  return {
    worldTime,
    year: gregorianYear + calendar.yearOffset,
    month,
    day,
    hour,
    minute,
    second,
    secondsIntoDay: hour * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE + second,
    weekdayIndex,
    dayOfYear: dayOfYear(utcMs),
    daysInYear: daysInYear(gregorianYear),
    season: seasonOf(month, day, calendar.seasons),
    ...named(calendar, month, weekdayIndex),
    era: calendar.era,
    // The underlying Gregorian year, not the displayed one: renaming months or shifting the era does
    // not change which day it is, so every calendar on this timeline shares the key.
    dayKey: dayKeyFor("", gregorianYear, month, day),
    festival: festivalOn(calendar, month, day),
  };
}

function describeFixed(reckoning: Reckoning, calendar: CalendarDefinition, worldTime: number): WorldDate {
  const date = describeWorldTime(reckoning, worldTime);
  const seconds = date.secondsIntoDay;

  return {
    worldTime,
    year: date.year,
    month: date.month,
    day: date.day,
    hour: Math.floor(seconds / SECONDS_PER_HOUR),
    minute: Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    second: seconds % SECONDS_PER_MINUTE,
    secondsIntoDay: seconds,
    weekdayIndex: date.weekdayIndex,
    dayOfYear: date.dayOfYear,
    daysInYear: reckoning.daysInYear,
    season: seasonOf(date.month, date.day, calendar.seasons),
    ...named(calendar, date.month, date.weekdayIndex),
    era: calendar.era,
    dayKey: dayKeyFor(calendar.name, date.year, date.month, date.day),
    festival: festivalOn(calendar, date.month, date.day),
  };
}

/** Anchored at world time zero, midnight, first weekday: what an epoch without an instant means. */
const ZERO_ANCHOR: EpochAnchor = { worldTime: 0, secondsIntoDay: 0, weekdayIndex: 0 };

let warnedUnanchorable = false;

/**
 * Turns the calendar's declared anchor instant into a world time.
 *
 * Preserving the instant's time of day is what keeps the clock's hands where they were when a world
 * switches calendars, and preserving its weekday keeps the day of the week. Both fall out of reading
 * the same instant PF2e would.
 */
function resolveAnchor(calendar: CalendarDefinition): EpochAnchor {
  const on = calendar.epoch?.on;
  if (!on) return ZERO_ANCHOR;

  // Substituting an origin here would silently move every date in the world, so this is the one
  // caller that must not accept the world-creation fallback.
  const createdOnMs = readWorldCreatedOnMs();
  if (createdOnMs === null) {
    if (!warnedUnanchorable) {
      warnedUnanchorable = true;
      console.warn(
        `${MODULE_ID} | cannot resolve the epoch "${on}" without the PF2e world creation date; anchoring "${calendar.name}" at world time zero instead, so its dates will not be the ones you configured`,
      );
    }
    return ZERO_ANCHOR;
  }

  // Validated when the calendar was parsed, so this cannot be NaN.
  const anchorMs = Date.parse(on);
  const d = new Date(anchorMs);
  return {
    worldTime: Math.round((anchorMs - createdOnMs) / 1000),
    secondsIntoDay: d.getUTCHours() * SECONDS_PER_HOUR + d.getUTCMinutes() * SECONDS_PER_MINUTE + d.getUTCSeconds(),
    weekdayIndex: (d.getUTCDay() + 6) % 7,
  };
}

/**
 * Built once per calendar rather than per read: the bar re-renders on every clock tick, and the
 * anchor cannot move while a calendar is in force. Identity of the calendar object is the cache key,
 * so replacing the active calendar invalidates it without needing to be told.
 */
let cached: { calendar: CalendarDefinition; reckoning: Reckoning } | null = null;

function reckoningFor(calendar: CalendarDefinition): Reckoning {
  if (cached?.calendar !== calendar) {
    cached = { calendar, reckoning: makeReckoning(calendar, resolveAnchor(calendar)) };
  }
  return cached.reckoning;
}

export function getWorldDate(worldTime: number = game.time.worldTime): WorldDate {
  const calendar = getCalendar();
  if (!hasOwnMonths(calendar)) {
    return describeGregorian(worldTimeToUtcMs(worldTime), calendar, worldTime);
  }
  return describeFixed(reckoningFor(calendar), calendar, worldTime);
}

/** The world time this in-world day began at. */
export function startOfDayWorldTime(worldTime: number = game.time.worldTime): number {
  const calendar = getCalendar();
  if (hasOwnMonths(calendar)) return startOfDay(reckoningFor(calendar), worldTime);
  return worldTime - describeGregorian(worldTimeToUtcMs(worldTime), calendar, worldTime).secondsIntoDay;
}

/** Signed seconds to add to reach the same date `count` months later, clamping into short months. */
export function monthStepSeconds(worldTime: number, count: number): number {
  const calendar = getCalendar();
  if (!hasOwnMonths(calendar)) return gregorianStepSeconds(worldTime, count, "month");
  return addMonths(reckoningFor(calendar), worldTime, count) - worldTime;
}

export function yearStepSeconds(worldTime: number, count: number): number {
  const calendar = getCalendar();
  if (!hasOwnMonths(calendar)) return gregorianStepSeconds(worldTime, count, "year");
  return addYears(reckoningFor(calendar), worldTime, count) - worldTime;
}

/** Month and year steps over the Gregorian structure, whose own helpers already clamp the day. */
function gregorianStepSeconds(worldTime: number, count: number, unit: "month" | "year"): number {
  const fromUtcMs = worldTimeToUtcMs(worldTime);
  const target = unit === "month" ? addMonthsUtc(fromUtcMs, count) : addYearsUtc(fromUtcMs, count);
  return Math.round((target - fromUtcMs) / 1000);
}

/**
 * The instant a date began at: the inverse of {@link getWorldDate}.
 *
 * Everything in the module so far asks "what date is this instant?". A month grid asks the other way —
 * given a year, a month and a day, what world time is that? Both backends already had the arithmetic for
 * their own reasons; this is the facade that picks one.
 *
 * `year` is the year as *displayed*, era offset included, because that is the number a caller reading the
 * bar or the grid actually has.
 */
export function worldTimeAtDate(year: number, month: number, day: number, secondsIntoDay = 0): number {
  const calendar = getCalendar();
  if (hasOwnMonths(calendar)) {
    return reckonWorldTimeAt(reckoningFor(calendar), year, month, day, secondsIntoDay);
  }
  return utcMsToWorldTime(gregorianUtcMs(calendar, year, month, day, secondsIntoDay));
}

/**
 * The key a day would carry, without resolving a time of day for it.
 *
 * `worldTimeAtDate` exists because moving the clock needs a world time; a note or a grid marker only
 * ever needs the key, and `dayKeyFor` never depended on the time of day. `year` is the year as
 * *displayed*, matching `worldTimeAtDate`.
 */
export function dayKeyAt(year: number, month: number, day: number): string {
  const calendar = getCalendar();
  if (hasOwnMonths(calendar)) return dayKeyFor(calendar.name, year, month, day);
  // The underlying Gregorian year, not the displayed one — see describeGregorian's own dayKey.
  return dayKeyFor("", year - calendar.yearOffset, month, day);
}

/**
 * A UTC instant from a displayed date, over the Gregorian structure.
 *
 * Built through `setUTCFullYear` rather than `Date.UTC`, which maps a year between 0 and 99 into the
 * 1900s — a calendar with no era offset and an early year would otherwise land nineteen centuries away.
 * Year, month and day are set together so no intermediate invalid date exists for `setUTCFullYear` to
 * roll over: setting the year first on a 29 February would silently become 1 March.
 */
function gregorianUtcMs(
  calendar: CalendarDefinition,
  year: number,
  month: number,
  day: number,
  secondsIntoDay: number,
): number {
  const date = new Date(0);
  date.setUTCFullYear(year - calendar.yearOffset, month - 1, day);
  date.setUTCHours(
    Math.floor(secondsIntoDay / SECONDS_PER_HOUR),
    Math.floor((secondsIntoDay % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    secondsIntoDay % SECONDS_PER_MINUTE,
    0,
  );
  return date.getTime();
}

/** How many months the active calendar's year has. */
export function monthsInYear(): number {
  return getCalendar().months.length;
}

/**
 * Wraps a month into its year, carrying into the year number.
 *
 * Month navigation runs on this, so stepping back from the first month of a year lands on the last month
 * of the one before rather than on month zero.
 */
export function normaliseMonth(year: number, month: number): { year: number; month: number } {
  const count = monthsInYear();
  const zeroBased = month - 1;
  const yearShift = Math.floor(zeroBased / count);
  return { year: year + yearShift, month: zeroBased - yearShift * count + 1 };
}

export interface MonthShape {
  /** Displayed year and month this describes, after normalisation. */
  year: number;
  month: number;
  /** How many days it has — which for the Gregorian structure depends on the year. */
  days: number;
  /**
   * Weekday index of day 1, in the calendar's own weekday list.
   *
   * This is what a grid needs and what the design reference does not compute: it prints weekday headers
   * and then lists days from the first column regardless, so its columns say nothing.
   */
  firstWeekdayIndex: number;
}

export function monthShape(year: number, month: number): MonthShape {
  const calendar = getCalendar();
  const at = normaliseMonth(year, month);

  if (hasOwnMonths(calendar)) {
    const reckoning = reckoningFor(calendar);
    const firstDay = reckonWorldTimeAt(reckoning, at.year, at.month, 1, 0);
    return {
      ...at,
      days: calendar.monthDays?.[at.month - 1] ?? 0,
      firstWeekdayIndex: describeWorldTime(reckoning, firstDay).weekdayIndex,
    };
  }

  const firstDay = new Date(gregorianUtcMs(calendar, at.year, at.month, 1, 0));
  return {
    ...at,
    days: daysInMonth(at.year - calendar.yearOffset, at.month),
    // getUTCDay() is 0-based on Sunday; the calendar's weekday list starts on the Monday-equivalent.
    firstWeekdayIndex: (firstDay.getUTCDay() + 6) % 7,
  };
}

/**
 * Signed seconds from `worldTime` to the moment this calendar's clock reads `targetMinutes` past
 * midnight, on the day it is now.
 *
 * Negative when that moment has already passed. That is what a timeline spanning one day requires:
 * dropping the handle to the left of where it was has to move time left. Rounding an earlier time up
 * to tomorrow's instead would turn a one-pixel drag backwards into a jump of nearly a full day.
 */
export function secondsToTimeOfDay(worldTime: number, targetMinutes: number): number {
  return startOfDayWorldTime(worldTime) + Math.round(targetMinutes * SECONDS_PER_MINUTE) - worldTime;
}
