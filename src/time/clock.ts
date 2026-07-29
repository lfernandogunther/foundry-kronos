import { MODULE_ID } from "../constants.js";
import { type CalendarDefinition, getCalendar, hasOwnMonths } from "./calendar.js";
import { addMonthsUtc, addYearsUtc, dayOfYear, daysInYear } from "./gregorian.js";
import { readWorldCreatedOnMs, worldTimeToUtcMs } from "./pf2e-clock.js";
import { type Season, seasonOf } from "./season.js";
import {
  addMonths,
  addYears,
  describeWorldTime,
  type EpochAnchor,
  makeReckoning,
  type Reckoning,
  startOfDay,
} from "./reckoning.js";

/**
 * What time it is, whichever calendar is in force.
 *
 * Two structures produce a date, and everything downstream of here is indifferent to which. The
 * Gregorian one reproduces PF2e's own formula so the two clocks agree; the fixed-length one counts
 * days from the calendar's own anchor and gives that agreement up. Nothing outside this file needs
 * to know the difference.
 */

const SECONDS_PER_DAY = 86_400;
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
  /** The active calendar's name, so keys derived from a date cannot collide across calendars. */
  calendarName: string;
  /** Named only on the days that carry one. */
  festival: string | null;
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
    calendarName: calendar.name,
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
    calendarName: calendar.name,
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

/**
 * Stable key for "which in-world day is it", used to decide when weather should be regenerated and
 * to pin a GM's override to a day.
 *
 * The calendar's name leads because two calendars label the same instant differently: without it,
 * one calendar's day would inherit the weather a GM set on another's.
 */
export function dateKeyOf(date: WorldDate): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.calendarName}:${date.year}-${mm}-${dd}`;
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

/** Seconds from `worldTime` to the next time this calendar's clock reads `targetMinutes` past midnight. */
export function secondsUntilTimeOfDay(worldTime: number, targetMinutes: number): number {
  const target = startOfDayWorldTime(worldTime) + Math.round(targetMinutes * SECONDS_PER_MINUTE);

  // Always forward: asking for sunrise at noon means tomorrow's sunrise, never this morning's. That
  // keeps the jump buttons from silently rewinding a session.
  return target <= worldTime ? target + SECONDS_PER_DAY - worldTime : target - worldTime;
}
