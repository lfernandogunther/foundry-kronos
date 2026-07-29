import { addMonthsUtc, addYearsUtc } from "./gregorian.js";

/**
 * The units the step arrows move by.
 *
 * Seconds through hours are fixed spans, so they convert straight to a delta. Months and years
 * are not — their length depends on where you start — so those are resolved against the current
 * instant instead of a constant.
 */
export type StepUnit = "second" | "round" | "minute" | "hour" | "day" | "month" | "year";

export const STEP_UNITS: readonly StepUnit[] = [
  "second",
  "round",
  "minute",
  "hour",
  "day",
  "month",
  "year",
] as const;

/** A Pathfinder 2e combat round is six seconds. */
export const ROUND_SECONDS = 6;

const FIXED_UNIT_SECONDS: Partial<Record<StepUnit, number>> = {
  second: 1,
  round: ROUND_SECONDS,
  minute: 60,
  hour: 3600,
  day: 86_400,
};

export function isStepUnit(value: unknown): value is StepUnit {
  return typeof value === "string" && (STEP_UNITS as readonly string[]).includes(value);
}

/**
 * How many seconds to advance to move `count` units from `fromUtcMs`.
 *
 * Returns a signed delta, so a negative count steps backwards. Month and year steps clamp the
 * day into shorter months, which means stepping forward then back is not always symmetric —
 * that is the same behaviour every calendar application has, and the alternative (drifting off
 * the end of February) is worse.
 */
export function stepSeconds(unit: StepUnit, count: number, fromUtcMs: number): number {
  const fixed = FIXED_UNIT_SECONDS[unit];
  if (fixed !== undefined) return fixed * count;

  const target = unit === "month" ? addMonthsUtc(fromUtcMs, count) : addYearsUtc(fromUtcMs, count);
  return Math.round((target - fromUtcMs) / 1000);
}

/**
 * Seconds from `fromUtcMs` to the next time the clock reads `targetMinutes` past midnight.
 *
 * Always forward: asking for sunrise at noon means tomorrow's sunrise, never this morning's.
 * That keeps the jump buttons from silently rewinding a session.
 */
export function secondsUntilTimeOfDay(fromUtcMs: number, targetMinutes: number): number {
  const d = new Date(fromUtcMs);
  const startOfDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const target = startOfDay + Math.round(targetMinutes * 60_000);
  const dayMs = 86_400_000;
  const delta = target <= fromUtcMs ? target + dayMs - fromUtcMs : target - fromUtcMs;
  return Math.round(delta / 1000);
}
