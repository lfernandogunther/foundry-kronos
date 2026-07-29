import { describe, expect, it } from "vitest";

import { type CalendarDefinition, parseCalendar } from "../../src/time/calendar.js";
import {
  addMonths,
  addYears,
  describeWorldTime,
  type EpochAnchor,
  makeReckoning,
  startOfDay,
  worldTimeAt,
} from "../../src/time/reckoning.js";

const DAY = 86_400;

/** Tarlan's shape: 365 days, five months of 31. Named generically so the test is about arithmetic. */
const LENGTHS = [31, 30, 31, 30, 31, 30, 31, 30, 30, 30, 30, 31];
const WEEKDAYS = ["Verdrag", "Eldora", "Thalorin", "Drusten", "Mithralis", "Sylvain", "Solara"];

function calendarWith(epoch: unknown): CalendarDefinition {
  const parsed = parseCalendar({
    name: "Tarlan",
    era: "TR",
    yearOffset: 0,
    months: LENGTHS.map((days, index) => ({ name: `Month${index + 1}`, days })),
    weekdays: WEEKDAYS,
    seasons: [],
    epoch,
  });
  if (!parsed) throw new Error("the fixture calendar should parse");
  return parsed;
}

/** What the facade derives for an epoch with no instant: world time zero, midnight, first weekday. */
const MIDNIGHT_ANCHOR: EpochAnchor = { worldTime: 0, secondsIntoDay: 0, weekdayIndex: 0 };

const tarlan = makeReckoning(calendarWith({ year: 1000, month: 1, day: 1 }), MIDNIGHT_ANCHOR);

describe("makeReckoning", () => {
  it("refuses a calendar that borrows the Gregorian structure", () => {
    const gregorian = parseCalendar({
      name: "Golarion",
      era: "AR",
      yearOffset: 2700,
      months: LENGTHS.map((_, index) => `Month${index + 1}`),
      weekdays: WEEKDAYS,
    });
    expect(() => makeReckoning(gregorian!, MIDNIGHT_ANCHOR)).toThrow(/month lengths/);
  });

  it("sums the month lengths into the year", () => {
    expect(tarlan.daysInYear).toBe(365);
  });
});

describe("describeWorldTime", () => {
  it("reports the anchor date at the anchor instant", () => {
    const date = describeWorldTime(tarlan, 0);
    expect(date).toMatchObject({ year: 1000, month: 1, day: 1, dayOfYear: 1, weekdayIndex: 0, secondsIntoDay: 0 });
  });

  it("keeps every day inside its month, and never invents a 32nd", () => {
    for (let index = 0; index < 365; index += 1) {
      const date = describeWorldTime(tarlan, index * DAY);
      expect(date.dayOfYear).toBe(index + 1);
      expect(date.day).toBeGreaterThanOrEqual(1);
      expect(date.day).toBeLessThanOrEqual(LENGTHS[date.month - 1]!);
      expect(date.year).toBe(1000);
    }
  });

  it("rolls from the last day of a month to the first of the next", () => {
    let expectedMonth = 1;
    for (let index = 0; index < 365; index += 1) {
      const today = describeWorldTime(tarlan, index * DAY);
      const tomorrow = describeWorldTime(tarlan, (index + 1) * DAY);
      expect(today.month).toBe(expectedMonth);
      if (today.day === LENGTHS[today.month - 1]) {
        expect(tomorrow.day).toBe(1);
        expectedMonth = today.month === 12 ? 1 : today.month + 1;
      } else {
        expect(tomorrow.day).toBe(today.day + 1);
      }
    }
  });

  it("rolls into the next year after the last day of the last month", () => {
    const lastDay = describeWorldTime(tarlan, 364 * DAY);
    expect(lastDay).toMatchObject({ year: 1000, month: 12, day: 31, dayOfYear: 365 });

    const newYear = describeWorldTime(tarlan, 365 * DAY);
    expect(newYear).toMatchObject({ year: 1001, month: 1, day: 1, dayOfYear: 1 });
  });

  it("advances the weekday by exactly one a day, cycling through all seven", () => {
    const seen = new Set<number>();
    for (let index = 0; index < 400; index += 1) {
      const { weekdayIndex } = describeWorldTime(tarlan, index * DAY);
      expect(weekdayIndex).toBe(index % WEEKDAYS.length);
      seen.add(weekdayIndex);
    }
    expect(seen.size).toBe(WEEKDAYS.length);
  });

  it("holds the date steady through a day and turns it over at the boundary", () => {
    expect(describeWorldTime(tarlan, DAY - 1).day).toBe(1);
    expect(describeWorldTime(tarlan, DAY).day).toBe(2);
    expect(describeWorldTime(tarlan, DAY + 1).secondsIntoDay).toBe(1);
  });

  // Foundry permits a negative world time, and truncating division would land these a day out and
  // run the weekday cycle backwards.
  describe("before the anchor", () => {
    it("reads the day before the anchor as the last day of the previous year", () => {
      const date = describeWorldTime(tarlan, -DAY);
      expect(date).toMatchObject({ year: 999, month: 12, day: 31, dayOfYear: 365 });
    });

    it("takes the weekday backwards without going negative", () => {
      expect(describeWorldTime(tarlan, -DAY).weekdayIndex).toBe(6);
      expect(describeWorldTime(tarlan, -2 * DAY).weekdayIndex).toBe(5);
      expect(describeWorldTime(tarlan, -8 * DAY).weekdayIndex).toBe(6);
    });

    it("reports a time of day inside the day, not a negative one", () => {
      const date = describeWorldTime(tarlan, -1);
      expect(date.secondsIntoDay).toBe(DAY - 1);
      expect(date).toMatchObject({ year: 999, month: 12, day: 31 });
    });

    it("keeps every day of a year before the anchor inside its month", () => {
      for (let index = 1; index <= 365; index += 1) {
        const date = describeWorldTime(tarlan, -index * DAY);
        expect(date.year).toBe(999);
        expect(date.day).toBeLessThanOrEqual(LENGTHS[date.month - 1]!);
      }
    });

    // Whole-day offsets cannot tell flooring from truncating, so the times of day here are
    // deliberately not multiples of a day.
    it("keeps the time of day within the day at every offset", () => {
      for (const worldTime of [-1, -5, -3_600, -DAY - 5, -DAY + 1, -400 * DAY - 77_400]) {
        const { secondsIntoDay } = describeWorldTime(tarlan, worldTime);
        expect(secondsIntoDay).toBeGreaterThanOrEqual(0);
        expect(secondsIntoDay).toBeLessThan(DAY);
      }
    });
  });
});

describe("worldTimeAt", () => {
  it("round-trips every day of a year", () => {
    for (let index = 0; index < 365; index += 1) {
      const original = describeWorldTime(tarlan, index * DAY + 3_600);
      const resolved = worldTimeAt(tarlan, original.year, original.month, original.day, original.secondsIntoDay);
      expect(describeWorldTime(tarlan, resolved)).toEqual(original);
    }
  });

  it("round-trips across the year boundary in both directions", () => {
    for (const worldTime of [-2 * DAY, -1, 0, 364 * DAY, 365 * DAY, 800 * DAY]) {
      const date = describeWorldTime(tarlan, worldTime);
      expect(worldTimeAt(tarlan, date.year, date.month, date.day, date.secondsIntoDay)).toBe(worldTime);
    }
  });
});

describe("an anchor that is not midnight", () => {
  // 21:30 on a Drusten, the fourth weekday — the case where preserving the clock's hands matters.
  const anchor: EpochAnchor = { worldTime: 500_000, secondsIntoDay: 77_400, weekdayIndex: 3 };
  const shifted = makeReckoning(calendarWith({ year: 1000, month: 1, day: 1 }), anchor);

  it("reports the anchor date with its hour and weekday intact", () => {
    expect(describeWorldTime(shifted, 500_000)).toMatchObject({
      year: 1000,
      month: 1,
      day: 1,
      weekdayIndex: 3,
      secondsIntoDay: 77_400,
    });
  });

  it("starts the day 21:30 before the anchor, not at the anchor", () => {
    expect(startOfDay(shifted, 500_000)).toBe(500_000 - 77_400);
    expect(describeWorldTime(shifted, startOfDay(shifted, 500_000)).secondsIntoDay).toBe(0);
  });

  it("turns the date over at its own boundary rather than at world-time midnight", () => {
    const boundary = 500_000 - 77_400 + DAY;
    expect(describeWorldTime(shifted, boundary - 1).day).toBe(1);
    expect(describeWorldTime(shifted, boundary).day).toBe(2);
  });
});

describe("startOfDay", () => {
  it("lands on the same day it was given", () => {
    for (const worldTime of [0, 12_345, 364 * DAY + 80_000, -1, -DAY - 5]) {
      const before = describeWorldTime(tarlan, worldTime);
      const after = describeWorldTime(tarlan, startOfDay(tarlan, worldTime));
      expect(after).toMatchObject({ year: before.year, month: before.month, day: before.day, secondsIntoDay: 0 });
    }
  });
});

describe("addMonths", () => {
  const at = (month: number, day: number, seconds = 0): number =>
    worldTimeAt(tarlan, 1000, month, day, seconds);

  it("clamps the day into a shorter target month", () => {
    // Month 1 has 31 days, month 2 has 30: the 31st has nowhere to land but the 30th.
    const moved = describeWorldTime(tarlan, addMonths(tarlan, at(1, 31), 1));
    expect(moved).toMatchObject({ year: 1000, month: 2, day: 30 });
  });

  it("keeps the day when the target month is long enough", () => {
    const moved = describeWorldTime(tarlan, addMonths(tarlan, at(2, 30), 1));
    expect(moved).toMatchObject({ year: 1000, month: 3, day: 30 });
  });

  it("carries into the next year", () => {
    const moved = describeWorldTime(tarlan, addMonths(tarlan, at(12, 31), 1));
    expect(moved).toMatchObject({ year: 1001, month: 1, day: 31 });
  });

  it("carries backwards into the previous year", () => {
    const moved = describeWorldTime(tarlan, addMonths(tarlan, at(1, 15), -1));
    expect(moved).toMatchObject({ year: 999, month: 12, day: 15 });
  });

  it("preserves the time of day and moves by whole days", () => {
    const from = at(5, 10, 45_296);
    const moved = addMonths(tarlan, from, 3);
    expect(describeWorldTime(tarlan, moved).secondsIntoDay).toBe(45_296);
    expect((moved - from) % DAY).toBe(0);
  });

  it("walks a full year one month at a time and returns to the same date", () => {
    let worldTime = at(3, 15);
    for (let step = 0; step < 12; step += 1) worldTime = addMonths(tarlan, worldTime, 1);
    expect(describeWorldTime(tarlan, worldTime)).toMatchObject({ year: 1001, month: 3, day: 15 });
  });
});

describe("addYears", () => {
  it("returns the same month and day a year later", () => {
    for (let month = 1; month <= 12; month += 1) {
      const from = worldTimeAt(tarlan, 1000, month, LENGTHS[month - 1]!, 0);
      const moved = describeWorldTime(tarlan, addYears(tarlan, from, 1));
      expect(moved).toMatchObject({ year: 1001, month, day: LENGTHS[month - 1]! });
    }
  });

  it("moves by exactly the length of the year, every month of it", () => {
    for (let month = 1; month <= 12; month += 1) {
      const from = worldTimeAt(tarlan, 1000, month, 1, 0);
      expect(addYears(tarlan, from, 1) - from).toBe(365 * DAY);
    }
  });
});
