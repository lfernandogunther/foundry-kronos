import bundledGolarion from "../../data/calendars/golarion-ar.json" with { type: "json" };
import { MODULE_ID } from "../constants.js";
import { DEFAULT_SEASON_BOUNDARIES, isSeason, type SeasonBoundary } from "./season.js";

/**
 * What a calendar is: the names, the structure, and where its reckoning is anchored.
 *
 * Two structures exist, and `monthDays` is what tells them apart. When it is null the months are
 * the Gregorian ones — twelve of them, February included, leap years and all — which is what keeps
 * agreement with the PF2e World Clock possible. When it carries lengths, the calendar owns its own
 * year and that agreement is given up.
 *
 * `months` stays a plain array of names in both cases, so everything reading a month *name* is
 * indifferent to which structure produced it.
 */
export interface CalendarDefinition {
  name: string;
  era: string;
  /** Added to the underlying Gregorian year. Meaningless, and zero, for calendars with an epoch. */
  yearOffset: number;
  /** Month names in order, the January-equivalent first. */
  months: string[];
  /** Month lengths aligned with `months`, or null to use the Gregorian structure. */
  monthDays: number[] | null;
  /** Weekday names, the Monday-equivalent first. */
  weekdays: string[];
  /** Where each season starts, as the (month, day) it begins on. */
  seasons: SeasonBoundary[];
  festivals: Festival[];
  /** Only meaningful alongside `monthDays`; null anchors the reckoning at world time zero. */
  epoch: CalendarEpoch | null;
}

export interface Festival {
  month: number;
  day: number;
  name: string;
}

/**
 * The instant a calendar counts from.
 *
 * `on` is an ISO instant rather than a world time because nobody can read a world time off the bar.
 * It is resolved through the same world-creation timestamp the Gregorian structure uses, which means
 * a GM can re-anchor the calendar from the date their own bar displays.
 */
export interface CalendarEpoch {
  /** ISO instant, or null to anchor at world time zero. */
  on: string | null;
  year: number;
  month: number;
  day: number;
}

/** Whether this calendar carries its own month lengths rather than borrowing the Gregorian ones. */
export function hasOwnMonths(calendar: CalendarDefinition): boolean {
  return calendar.monthDays !== null;
}

/** Non-leap Gregorian years and every fixed-length calendar have a constant year length. */
export function daysInCalendarYear(calendar: CalendarDefinition): number {
  return calendar.monthDays?.reduce((total, days) => total + days, 0) ?? 365;
}

/** PF2e's date themes. We display Golarion, so AR is the one we care about. */
const PF2E_THEME = "AR";

/** The Gregorian structure is the only one whose month and weekday counts are fixed. */
const GREGORIAN_MONTHS = 12;
const GREGORIAN_WEEKDAYS = 7;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

/**
 * Splits the two accepted month shapes into names and lengths.
 *
 * Bare strings are what every calendar file written against the previous version contains, and they
 * have to keep meaning what they meant: names over the Gregorian structure. Objects carrying a day
 * count are the new shape, and select the calendar's own arithmetic.
 */
function readMonths(value: unknown): { months: string[]; monthDays: number[] | null } | null {
  if (isStringArray(value)) return { months: value, monthDays: null };
  if (!Array.isArray(value) || value.length === 0) return null;

  const months: string[] = [];
  const monthDays: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const month = entry as { name?: unknown; days?: unknown };
    if (typeof month.name !== "string" || !isPositiveInteger(month.days)) return null;
    months.push(month.name);
    monthDays.push(month.days);
  }
  return { months, monthDays };
}

function readSeasons(value: unknown, monthCount: number): SeasonBoundary[] | null {
  if (value === undefined) return [...DEFAULT_SEASON_BOUNDARIES];
  if (!Array.isArray(value)) return null;

  const boundaries: SeasonBoundary[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const boundary = entry as { month?: unknown; day?: unknown; season?: unknown };
    if (!isPositiveInteger(boundary.month) || boundary.month > monthCount) return null;
    if (!isPositiveInteger(boundary.day) || !isSeason(boundary.season)) return null;
    boundaries.push({ month: boundary.month, day: boundary.day, season: boundary.season });
  }

  // Resolving a season walks these in order and keeps the last one passed, so a file listing them
  // out of order would silently mislabel part of the year.
  return boundaries.sort((a, b) => a.month - b.month || a.day - b.day);
}

function readFestivals(value: unknown, monthCount: number): Festival[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const festivals: Festival[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const festival = entry as { month?: unknown; day?: unknown; name?: unknown };
    if (!isPositiveInteger(festival.month) || festival.month > monthCount) return null;
    if (!isPositiveInteger(festival.day) || typeof festival.name !== "string") return null;
    festivals.push({ month: festival.month, day: festival.day, name: festival.name });
  }
  return festivals;
}

/** Returns undefined — distinct from a valid null — when the epoch is present but malformed. */
function readEpoch(value: unknown, monthCount: number): CalendarEpoch | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") return undefined;

  const epoch = value as { on?: unknown; year?: unknown; month?: unknown; day?: unknown };
  if (typeof epoch.year !== "number" || !Number.isInteger(epoch.year)) return undefined;
  if (!isPositiveInteger(epoch.month) || epoch.month > monthCount) return undefined;
  if (!isPositiveInteger(epoch.day)) return undefined;

  // An unparseable instant is rejected rather than ignored: quietly falling back to world time zero
  // would move every date in the world without saying so.
  if (epoch.on !== undefined && epoch.on !== null) {
    if (typeof epoch.on !== "string" || Number.isNaN(Date.parse(epoch.on))) return undefined;
  }

  return {
    on: typeof epoch.on === "string" ? epoch.on : null,
    year: epoch.year,
    month: epoch.month,
    day: epoch.day,
  };
}

/**
 * Turns raw JSON into a calendar, or returns null having said why.
 *
 * Everything optional gets a default that reproduces the previous behaviour, so a file written for
 * the earlier version parses into exactly the calendar it described before.
 */
export function parseCalendar(raw: unknown): CalendarDefinition | null {
  const reject = (why: string): null => {
    console.error(`${MODULE_ID} | rejected calendar: ${why}`);
    return null;
  };

  if (typeof raw !== "object" || raw === null) return reject("not an object");
  const source = raw as Record<string, unknown>;

  if (typeof source["name"] !== "string") return reject("missing name");
  if (typeof source["era"] !== "string") return reject("missing era");
  if (typeof source["yearOffset"] !== "number") return reject("missing yearOffset");

  const months = readMonths(source["months"]);
  if (!months) return reject("months must be names, or objects with a name and a positive day count");

  if (!isStringArray(source["weekdays"]) || source["weekdays"].length === 0) return reject("missing weekdays");
  const weekdays = source["weekdays"];

  // Only the Gregorian structure is pinned to twelve and seven. A calendar with its own month
  // lengths may have any number of either, which is most of the point of carrying them.
  if (months.monthDays === null) {
    if (months.months.length !== GREGORIAN_MONTHS) {
      return reject(`the Gregorian structure needs exactly ${GREGORIAN_MONTHS} months, got ${months.months.length}`);
    }
    if (weekdays.length !== GREGORIAN_WEEKDAYS) {
      return reject(`the Gregorian structure needs exactly ${GREGORIAN_WEEKDAYS} weekdays, got ${weekdays.length}`);
    }
  }

  const seasons = readSeasons(source["seasons"], months.months.length);
  if (!seasons) return reject("malformed seasons");

  const festivals = readFestivals(source["festivals"], months.months.length);
  if (!festivals) return reject("malformed festivals");

  const epoch = readEpoch(source["epoch"], months.months.length);
  if (epoch === undefined) return reject("malformed epoch");

  // A day past the end of its month would never be reached, which makes it a typo rather than a
  // choice. Only checkable where the calendar states its own lengths.
  const lengths = months.monthDays;
  if (lengths) {
    const overflow = [...seasons, ...festivals].find((entry) => entry.day > lengths[entry.month - 1]!);
    if (overflow) return reject(`day ${overflow.day} is past the end of month ${overflow.month}`);
    if (epoch && epoch.day > lengths[epoch.month - 1]!) {
      return reject(`the epoch day ${epoch.day} is past the end of month ${epoch.month}`);
    }
  }

  return {
    name: source["name"],
    era: source["era"],
    yearOffset: source["yearOffset"],
    months: months.months,
    monthDays: months.monthDays,
    weekdays,
    seasons,
    festivals,
    epoch,
  };
}

/**
 * The bundled Golarion set. A failure here is a broken build rather than bad user input, so it
 * throws instead of degrading — a null would surface much later as an unexplained blank bar.
 */
function requireBundled(): CalendarDefinition {
  const parsed = parseCalendar(bundledGolarion);
  if (!parsed) throw new Error(`${MODULE_ID} | the bundled Golarion calendar is malformed`);
  return parsed;
}

export const BUNDLED_CALENDAR: CalendarDefinition = requireBundled();

/**
 * Prefer the live PF2e config so we inherit whatever the installed system says, and fall back to
 * the bundled set when it is absent or shaped differently than expected. The system's values are
 * localization keys, so each one is run through i18n; `localize` returns the key unchanged when
 * there is no translation, which is exactly the degraded behaviour we want.
 *
 * What comes back is always the Gregorian structure — that is what PF2e's clock is.
 */
export function calendarFromSystem(): CalendarDefinition | null {
  const theme = CONFIG.PF2E?.worldClock?.[PF2E_THEME];
  if (!theme) return null;

  const localize = (s: string): string => game.i18n?.localize(s) ?? s;
  return parseCalendar({
    name: BUNDLED_CALENDAR.name,
    era: theme.era ? localize(theme.era) : BUNDLED_CALENDAR.era,
    yearOffset: theme.yearOffset ?? BUNDLED_CALENDAR.yearOffset,
    months: theme.months?.map(localize) ?? BUNDLED_CALENDAR.months,
    weekdays: theme.weekdays?.map(localize) ?? BUNDLED_CALENDAR.weekdays,
  });
}

let active: CalendarDefinition = BUNDLED_CALENDAR;

export function getCalendar(): CalendarDefinition {
  return active;
}

export function setCalendar(calendar: CalendarDefinition): void {
  active = calendar;
}

/**
 * Fetch a replacement calendar served from the module folder. Anything malformed is rejected in
 * favour of the current one — a half-applied calendar would render worse than the default.
 */
export async function loadCalendar(path: string): Promise<CalendarDefinition | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseCalendar(await response.json());
  } catch (error) {
    console.error(`${MODULE_ID} | could not load a calendar from "${path}":`, error);
    return null;
  }
}
