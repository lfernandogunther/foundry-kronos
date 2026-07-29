import { describe, expect, it } from "vitest";

import { isStepUnit, ROUND_SECONDS, stepSeconds } from "../../src/time/units.js";

/** The test world was created at the Unix epoch, so a world time is seconds since 1970. */
const at = (y: number, m: number, d: number, h = 0, min = 0): number => Date.UTC(y, m - 1, d, h, min) / 1000;
const HOUR = 3600;
const DAY = 86_400;

describe("fixed step units", () => {
  const anyDate = at(2025, 6, 15, 12, 0);

  it("converts each fixed unit to its span in seconds", () => {
    expect(stepSeconds("second", 1, anyDate)).toBe(1);
    expect(stepSeconds("minute", 1, anyDate)).toBe(60);
    expect(stepSeconds("hour", 1, anyDate)).toBe(HOUR);
    expect(stepSeconds("day", 1, anyDate)).toBe(DAY);
  });

  it("uses the six-second Pathfinder combat round", () => {
    expect(ROUND_SECONDS).toBe(6);
    expect(stepSeconds("round", 1, anyDate)).toBe(6);
    expect(stepSeconds("round", 10, anyDate)).toBe(60);
  });

  it("returns a negative delta for a negative count", () => {
    expect(stepSeconds("hour", -3, anyDate)).toBe(-3 * HOUR);
  });
});

// The default calendar is Golarion, which borrows the Gregorian structure — so these also guard
// that swapping in the calendar layer left that structure's arithmetic alone.
describe("month steps over the Gregorian structure", () => {
  it("uses the real length of the month being crossed", () => {
    // January into February: 31 days.
    expect(stepSeconds("month", 1, at(2025, 1, 1))).toBe(31 * DAY);
    // April into May: 30 days.
    expect(stepSeconds("month", 1, at(2025, 4, 1))).toBe(30 * DAY);
  });

  it("crosses a leap February with the extra day", () => {
    expect(stepSeconds("month", 1, at(2024, 2, 1))).toBe(29 * DAY);
    expect(stepSeconds("month", 1, at(2025, 2, 1))).toBe(28 * DAY);
  });

  it("clamps rather than overshooting out of a long month", () => {
    // 31 January + 1 month is 28 February, three days on, not the 31 a fixed span would give.
    expect(stepSeconds("month", 1, at(2025, 1, 31))).toBe(28 * DAY);
  });

  it("steps backwards across a year boundary", () => {
    expect(stepSeconds("month", -1, at(2025, 1, 15))).toBe(-31 * DAY);
  });
});

describe("year steps over the Gregorian structure", () => {
  it("counts an extra day when the span contains a leap day", () => {
    expect(stepSeconds("year", 1, at(2023, 6, 1))).toBe(366 * DAY);
    expect(stepSeconds("year", 1, at(2025, 6, 1))).toBe(365 * DAY);
  });

  it("clamps a leap day onto 28 February", () => {
    expect(stepSeconds("year", 1, at(2024, 2, 29))).toBe(365 * DAY);
  });
});

describe("isStepUnit", () => {
  it("accepts the units the select offers and rejects anything else", () => {
    expect(isStepUnit("round")).toBe(true);
    expect(isStepUnit("year")).toBe(true);
    expect(isStepUnit("fortnight")).toBe(false);
    expect(isStepUnit(6)).toBe(false);
  });
});
