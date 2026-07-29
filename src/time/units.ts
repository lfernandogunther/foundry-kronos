import { monthStepSeconds, yearStepSeconds } from "./clock.js";

/**
 * The units the step arrows move by.
 *
 * Seconds through hours are fixed spans, so they convert straight to a delta. Months and years
 * are not — their length depends on where you start, and on which calendar is in force — so those
 * are resolved against the active calendar instead of a constant.
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
 * How many seconds to advance to move `count` units from `fromWorldTime`.
 *
 * Returns a signed delta, so a negative count steps backwards. Month and year steps clamp the
 * day into shorter months, which means stepping forward then back is not always symmetric —
 * that is the same behaviour every calendar application has, and the alternative (drifting off
 * the end of a short month) is worse.
 */
export function stepSeconds(unit: StepUnit, count: number, fromWorldTime: number): number {
  const fixed = FIXED_UNIT_SECONDS[unit];
  if (fixed !== undefined) return fixed * count;

  return unit === "month" ? monthStepSeconds(fromWorldTime, count) : yearStepSeconds(fromWorldTime, count);
}
