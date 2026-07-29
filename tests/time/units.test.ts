import { describe, expect, it } from "vitest";

import { isStepUnit, ROUND_SECONDS, secondsUntilTimeOfDay, stepSeconds } from "../../src/time/units.js";

const utc = (y: number, m: number, d: number, h = 0, min = 0): number => Date.UTC(y, m - 1, d, h, min);
const HOUR = 3600;
const DAY = 86_400;

describe("fixed step units", () => {
  const anyDate = utc(2025, 6, 15, 12, 0);

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

describe("month steps", () => {
  it("uses the real length of the month being crossed", () => {
    // January into February: 31 days.
    expect(stepSeconds("month", 1, utc(2025, 1, 1))).toBe(31 * DAY);
    // April into May: 30 days.
    expect(stepSeconds("month", 1, utc(2025, 4, 1))).toBe(30 * DAY);
  });

  it("crosses a leap February with the extra day", () => {
    expect(stepSeconds("month", 1, utc(2024, 2, 1))).toBe(29 * DAY);
    expect(stepSeconds("month", 1, utc(2025, 2, 1))).toBe(28 * DAY);
  });

  it("clamps rather than overshooting out of a long month", () => {
    // 31 January + 1 month is 28 February, three days on, not the 31 a fixed span would give.
    expect(stepSeconds("month", 1, utc(2025, 1, 31))).toBe(28 * DAY);
  });

  it("steps backwards across a year boundary", () => {
    expect(stepSeconds("month", -1, utc(2025, 1, 15))).toBe(-31 * DAY);
  });
});

describe("year steps", () => {
  it("counts an extra day when the span contains a leap day", () => {
    expect(stepSeconds("year", 1, utc(2023, 6, 1))).toBe(366 * DAY);
    expect(stepSeconds("year", 1, utc(2025, 6, 1))).toBe(365 * DAY);
  });

  it("clamps a leap day onto 28 February", () => {
    expect(stepSeconds("year", 1, utc(2024, 2, 29))).toBe(365 * DAY);
  });
});

describe("secondsUntilTimeOfDay", () => {
  it("moves forward within the same day", () => {
    // 08:00, jumping to noon.
    expect(secondsUntilTimeOfDay(utc(2025, 6, 15, 8, 0), 12 * 60)).toBe(4 * HOUR);
  });

  it("rolls into tomorrow rather than rewinding", () => {
    // 14:00, asking for 06:00 — that is tomorrow morning, 16 hours ahead.
    expect(secondsUntilTimeOfDay(utc(2025, 6, 15, 14, 0), 6 * 60)).toBe(16 * HOUR);
  });

  it("treats the current instant as a full day away, never as zero", () => {
    // Standing exactly on noon and asking for noon should advance a day, not do nothing.
    expect(secondsUntilTimeOfDay(utc(2025, 6, 15, 12, 0), 12 * 60)).toBe(DAY);
  });

  it("never returns a negative delta, at any time of day", () => {
    for (let minute = 0; minute < 1440; minute += 7) {
      for (const target of [0, 245, 720, 1195, 1439]) {
        expect(secondsUntilTimeOfDay(utc(2025, 6, 15) + minute * 60_000, target)).toBeGreaterThan(0);
      }
    }
  });

  it("handles a fractional target time", () => {
    // 04:05 sunrise from midnight.
    expect(secondsUntilTimeOfDay(utc(2025, 6, 15, 0, 0), 244.86)).toBe(14_692);
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
