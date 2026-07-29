import { describe, expect, it } from "vitest";

import {
  addMonthsUtc,
  addYearsUtc,
  dayOfYear,
  daysInMonth,
  daysInYear,
  isLeapYear,
} from "../../src/time/gregorian.js";

const utc = (y: number, m: number, d: number, h = 0, min = 0): number => Date.UTC(y, m - 1, d, h, min);
const iso = (ms: number): string => new Date(ms).toISOString();

describe("isLeapYear", () => {
  it("follows the century rules, not just divisibility by four", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe("daysInMonth", () => {
  it("gives the right length for every month", () => {
    const lengths = Array.from({ length: 12 }, (_, i) => daysInMonth(2025, i + 1));
    expect(lengths).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it("gives February an extra day in a leap year", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
  });
});

describe("dayOfYear", () => {
  it("counts from 1 on 1 January to the last day of December", () => {
    expect(dayOfYear(utc(2025, 1, 1))).toBe(1);
    expect(dayOfYear(utc(2025, 12, 31))).toBe(365);
    expect(dayOfYear(utc(2024, 12, 31))).toBe(366);
  });

  it("is unaffected by the time of day", () => {
    expect(dayOfYear(utc(2025, 6, 15, 23, 59))).toBe(dayOfYear(utc(2025, 6, 15, 0, 0)));
  });
});

describe("addMonthsUtc", () => {
  it("clamps into a shorter month instead of spilling into the next one", () => {
    // Native Date arithmetic would land this on 3 March.
    expect(iso(addMonthsUtc(utc(2025, 1, 31), 1))).toBe("2025-02-28T00:00:00.000Z");
    expect(iso(addMonthsUtc(utc(2025, 3, 31), 1))).toBe("2025-04-30T00:00:00.000Z");
  });

  it("clamps to 29 February in a leap year", () => {
    expect(iso(addMonthsUtc(utc(2024, 1, 31), 1))).toBe("2024-02-29T00:00:00.000Z");
  });

  it("rolls the year over in both directions", () => {
    expect(iso(addMonthsUtc(utc(2025, 12, 15), 1))).toBe("2026-01-15T00:00:00.000Z");
    expect(iso(addMonthsUtc(utc(2025, 1, 15), -1))).toBe("2024-12-15T00:00:00.000Z");
  });

  it("keeps the time of day", () => {
    expect(iso(addMonthsUtc(utc(2025, 5, 10, 11, 15), 3))).toBe("2025-08-10T11:15:00.000Z");
  });

  it("is reversible when no clamping happened", () => {
    const start = utc(2025, 5, 15, 8, 30);
    expect(addMonthsUtc(addMonthsUtc(start, 7), -7)).toBe(start);
  });
});

describe("addYearsUtc", () => {
  it("clamps a leap day onto 28 February", () => {
    expect(iso(addYearsUtc(utc(2024, 2, 29), 1))).toBe("2025-02-28T00:00:00.000Z");
  });

  it("leaves an ordinary date alone", () => {
    expect(iso(addYearsUtc(utc(2025, 7, 4, 12, 0), 3))).toBe("2028-07-04T12:00:00.000Z");
  });
});
