import bundledGolarion from "../../data/calendars/golarion-ar.json" with { type: "json" };
import { MODULE_ID } from "../constants.js";

/**
 * The display layer of the calendar: what the months and weekdays are called, the era suffix,
 * and how far the displayed year sits from the underlying Gregorian one.
 *
 * Swapping these changes names only. Month *lengths* come from the Gregorian structure the PF2e
 * World Clock is built on, and cannot be redefined here without breaking agreement with it.
 */
export interface CalendarLabels {
  name: string;
  era: string;
  yearOffset: number;
  /** 12 entries, January-equivalent first. */
  months: string[];
  /** 7 entries, Monday-equivalent first. */
  weekdays: string[];
}

export const BUNDLED_LABELS: CalendarLabels = bundledGolarion;

/** PF2e's date themes. We display Golarion, so AR is the one we care about. */
const PF2E_THEME = "AR";

export function isCalendarLabels(value: unknown): value is CalendarLabels {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Partial<CalendarLabels>;
  return (
    typeof c.name === "string" &&
    typeof c.era === "string" &&
    typeof c.yearOffset === "number" &&
    Array.isArray(c.months) &&
    c.months.length === 12 &&
    c.months.every((m) => typeof m === "string") &&
    Array.isArray(c.weekdays) &&
    c.weekdays.length === 7 &&
    c.weekdays.every((d) => typeof d === "string")
  );
}

/**
 * Prefer the live PF2e config so we inherit whatever the installed system says, and fall back to
 * the bundled set when it is absent or shaped differently than expected. The system's values are
 * localization keys, so each one is run through i18n; `localize` returns the key unchanged when
 * there is no translation, which is exactly the degraded behaviour we want.
 */
export function labelsFromSystem(): CalendarLabels | null {
  const theme = CONFIG.PF2E?.worldClock?.[PF2E_THEME];
  if (!theme) return null;

  const localize = (s: string): string => game.i18n?.localize(s) ?? s;
  const candidate = {
    name: BUNDLED_LABELS.name,
    era: theme.era ? localize(theme.era) : BUNDLED_LABELS.era,
    yearOffset: theme.yearOffset ?? BUNDLED_LABELS.yearOffset,
    months: theme.months?.map(localize) ?? BUNDLED_LABELS.months,
    weekdays: theme.weekdays?.map(localize) ?? BUNDLED_LABELS.weekdays,
  };

  return isCalendarLabels(candidate) ? candidate : null;
}

let active: CalendarLabels = BUNDLED_LABELS;

export function getCalendarLabels(): CalendarLabels {
  return active;
}

export function setCalendarLabels(labels: CalendarLabels): void {
  active = labels;
}

/**
 * Fetch a replacement label set served from the module folder. Anything malformed is rejected in
 * favour of the current set — a half-applied calendar would render worse than the default one.
 */
export async function loadCalendarLabels(path: string): Promise<CalendarLabels | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed: unknown = await response.json();
    if (!isCalendarLabels(parsed)) throw new Error("missing or malformed months/weekdays/yearOffset");
    return parsed;
  } catch (error) {
    console.error(`${MODULE_ID} | could not load calendar labels from "${path}":`, error);
    return null;
  }
}
