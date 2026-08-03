import { afterEach, describe, expect, it } from "vitest";

import { BUNDLED_CALENDAR, type CalendarDefinition, parseCalendar, setCalendar } from "../../src/time/calendar.js";
import {
  dayKeyAt,
  describeGregorian,
  getWorldDate,
  monthsInYear,
  monthShape,
  normaliseMonth,
  secondsToTimeOfDay,
  startOfDayWorldTime,
  worldTimeAtDate,
} from "../../src/time/clock.js";

/** The test world was created at the Unix epoch, so a world time is seconds since 1970. */
const at = (y: number, m: number, d: number, h = 0, min = 0): number => Date.UTC(y, m - 1, d, h, min) / 1000;
const HOUR = 3600;
const DAY = 86_400;

describe("describeGregorian", () => {
  // 8 December 2025 was a Monday, so this is the mockup's reading in real Golarion terms.
  const date = describeGregorian(Date.UTC(2025, 11, 8, 11, 15, 0), BUNDLED_CALENDAR, 0);

  it("applies the era offset to the displayed year", () => {
    expect(date.year).toBe(4725);
    expect(date.era).toBe("AR");
  });

  it("names the month from the calendar", () => {
    expect(date.month).toBe(12);
    expect(date.monthName).toBe("Kuthona");
    expect(date.day).toBe(8);
  });

  it("indexes weekdays from the Monday-equivalent", () => {
    expect(date.weekdayIndex).toBe(0);
    expect(date.weekdayName).toBe("Moonday");
  });

  it("reads the time in UTC", () => {
    expect(date.hour).toBe(11);
    expect(date.minute).toBe(15);
    expect(date.secondsIntoDay).toBe(11 * 3600 + 15 * 60);
  });

  it("maps a Sunday onto the last weekday of the list", () => {
    // 7 December 2025, the day before the sample.
    const sunday = describeGregorian(Date.UTC(2025, 11, 7), BUNDLED_CALENDAR, 0);
    expect(sunday.weekdayIndex).toBe(6);
    expect(sunday.weekdayName).toBe("Sunday");
  });

  it("reports the real length of the year, leap years included", () => {
    expect(describeGregorian(Date.UTC(2024, 5, 1), BUNDLED_CALENDAR, 0).daysInYear).toBe(366);
    expect(describeGregorian(Date.UTC(2025, 5, 1), BUNDLED_CALENDAR, 0).daysInYear).toBe(365);
  });

  it("names a festival only on the day it falls on", () => {
    const withFestival = parseCalendar({
      name: "Golarion",
      era: "AR",
      yearOffset: 2700,
      months: BUNDLED_CALENDAR.months,
      weekdays: BUNDLED_CALENDAR.weekdays,
      festivals: [{ month: 12, day: 8, name: "Kuthonabright" }],
    }) as CalendarDefinition;

    expect(describeGregorian(Date.UTC(2025, 11, 8), withFestival, 0).festival).toBe("Kuthonabright");
    expect(describeGregorian(Date.UTC(2025, 11, 9), withFestival, 0).festival).toBeNull();
  });
});

describe("the day key over the Gregorian structure", () => {
  const keyAt = (utcMs: number, calendar = BUNDLED_CALENDAR): string =>
    describeGregorian(utcMs, calendar, 0).dayKey;

  it("is stable across times within the same day", () => {
    expect(keyAt(Date.UTC(2025, 11, 8, 0, 1))).toBe(keyAt(Date.UTC(2025, 11, 8, 23, 59)));
  });

  it("changes across midnight", () => {
    expect(keyAt(Date.UTC(2025, 11, 8, 23, 59))).not.toBe(keyAt(Date.UTC(2025, 11, 9, 0, 0)));
  });

  // The weather is seeded from this string, so changing its shape rerolls every day of a world that
  // has been running. It is the underlying Gregorian year, padded, and unprefixed.
  it("keeps the shape a running world has been generating weather from", () => {
    expect(keyAt(Date.UTC(2025, 0, 5))).toBe("2025-01-05");
    expect(keyAt(Date.UTC(2025, 11, 8))).toBe("2025-12-08");
  });

  it("does not change when the era or the month names do", () => {
    const renamed = {
      ...BUNDLED_CALENDAR,
      name: "A different reckoning",
      era: "IC",
      yearOffset: 0,
      months: BUNDLED_CALENDAR.months.map((_, index) => `Month${index + 1}`),
    };
    expect(keyAt(Date.UTC(2025, 0, 5), renamed)).toBe(keyAt(Date.UTC(2025, 0, 5)));
  });
});

describe("secondsToTimeOfDay over the Gregorian structure", () => {
  it("moves forward when the target is later in the day", () => {
    // 08:00, setting the clock to noon.
    expect(secondsToTimeOfDay(at(2025, 6, 15, 8, 0), 12 * 60)).toBe(4 * HOUR);
  });

  it("rewinds when the target is earlier in the day", () => {
    // 14:00, setting the clock to 06:00 — this morning, eight hours back, not tomorrow morning.
    // The timeline spans one day, so dragging the handle left has to move time left.
    expect(secondsToTimeOfDay(at(2025, 6, 15, 14, 0), 6 * 60)).toBe(-8 * HOUR);
  });

  it("is zero when the clock already reads the target", () => {
    expect(secondsToTimeOfDay(at(2025, 6, 15, 12, 0), 12 * 60)).toBe(0);
  });

  it("stays inside the day it started in, at any time and for any target", () => {
    // The one invariant the drag depends on: no gesture on a one-day bar may change the date.
    for (let minute = 0; minute < 1440; minute += 7) {
      const worldTime = at(2025, 6, 15) + minute * 60;
      for (const target of [0, 245, 720, 1195, 1439]) {
        const landed = worldTime + secondsToTimeOfDay(worldTime, target);
        expect(landed).toBeGreaterThanOrEqual(at(2025, 6, 15));
        expect(landed).toBeLessThan(at(2025, 6, 16));
      }
    }
  });

  it("handles a fractional target time", () => {
    // 04:05 sunrise from midnight.
    expect(secondsToTimeOfDay(at(2025, 6, 15, 0, 0), 244.86)).toBe(14_692);
  });
});

describe("worldTimeAtDate over the Gregorian structure", () => {
  it("is the inverse of reading a date", () => {
    // The whole point: a grid hands back a year, month and day, and the clock has to land on it.
    for (const [year, month, day] of [
      [4725, 12, 8],
      [4725, 1, 1],
      [4724, 2, 29],
      [4700, 6, 15],
    ] as const) {
      const resolved = worldTimeAtDate(year, month, day, 14 * HOUR + 30 * 60);
      expect(getWorldDate(resolved), `${day}/${month}/${year}`).toMatchObject({
        year,
        month,
        day,
        hour: 14,
        minute: 30,
      });
    }
  });

  it("takes the displayed year, era offset included", () => {
    // Golarion is Gregorian plus 2700, so Kuthona 8 of 4725 AR is 8 December 2025.
    expect(worldTimeAtDate(4725, 12, 8)).toBe(at(2025, 12, 8));
  });

  it("keeps the time of day it was given, and defaults to midnight", () => {
    expect(worldTimeAtDate(4725, 12, 8, 22 * HOUR)).toBe(at(2025, 12, 8, 22));
    expect(worldTimeAtDate(4725, 12, 8)).toBe(at(2025, 12, 8));
  });

  it("does not drop an early year into the twentieth century", () => {
    // `Date.UTC` maps a year between 0 and 99 into the 1900s. A calendar with no era offset would
    // otherwise put year 50 nineteen centuries away, and every date in it would be wrong by a
    // margin nobody would attribute to this.
    const noOffset = parseCalendar({
      name: "Unoffset",
      era: "CE",
      yearOffset: 0,
      months: BUNDLED_CALENDAR.months,
      weekdays: BUNDLED_CALENDAR.weekdays,
    }) as CalendarDefinition;

    setCalendar(noOffset);
    try {
      expect(getWorldDate(worldTimeAtDate(50, 3, 4))).toMatchObject({ year: 50, month: 3, day: 4 });
    } finally {
      setCalendar(BUNDLED_CALENDAR);
    }
  });
});

describe("monthShape over the Gregorian structure", () => {
  it("gives February its real length, by the underlying year", () => {
    // 2024 is a leap year and 2025 is not; the displayed years are those plus 2700.
    expect(monthShape(4724, 2).days).toBe(29);
    expect(monthShape(4725, 2).days).toBe(28);
    expect(monthShape(4700, 2).days).toBe(29);
    expect(monthShape(4800, 2).days).toBe(28);
  });

  it("gives every other month the length it always has", () => {
    expect([1, 3, 5, 7, 8, 10, 12].map((month) => monthShape(4725, month).days)).toEqual([
      31, 31, 31, 31, 31, 31, 31,
    ]);
    expect([4, 6, 9, 11].map((month) => monthShape(4725, month).days)).toEqual([30, 30, 30, 30]);
  });

  it("puts day 1 on the weekday it actually falls on", () => {
    // 8 December 2025 was a Monday, so the 1st was too, and Monday is index 0.
    expect(monthShape(4725, 12).firstWeekdayIndex).toBe(0);
    expect(getWorldDate(worldTimeAtDate(4725, 12, 1)).weekdayIndex).toBe(0);

    // And the two agree for every month of a year, which is the property a grid depends on.
    for (let month = 1; month <= 12; month += 1) {
      const shape = monthShape(4725, month);
      expect(shape.firstWeekdayIndex, `month ${month}`).toBe(
        getWorldDate(worldTimeAtDate(4725, month, 1)).weekdayIndex,
      );
      expect(shape.days, `month ${month}`).toBe(
        getWorldDate(worldTimeAtDate(4725, month, 1) + (shape.days - 1) * DAY).day,
      );
    }
  });
});

describe("normaliseMonth", () => {
  it("leaves a month inside the year alone", () => {
    expect(normaliseMonth(4725, 1)).toEqual({ year: 4725, month: 1 });
    expect(normaliseMonth(4725, 12)).toEqual({ year: 4725, month: 12 });
  });

  it("carries into the next year and back into the previous one", () => {
    expect(normaliseMonth(4725, 13)).toEqual({ year: 4726, month: 1 });
    expect(normaliseMonth(4725, 0)).toEqual({ year: 4724, month: 12 });
    expect(normaliseMonth(4725, -1)).toEqual({ year: 4724, month: 11 });
    expect(normaliseMonth(4725, 25)).toEqual({ year: 4727, month: 1 });
  });

  it("stays inside the year for every month it produces", () => {
    for (let month = -30; month <= 40; month += 1) {
      const normalised = normaliseMonth(4725, month);
      expect(normalised.month, `from ${month}`).toBeGreaterThanOrEqual(1);
      expect(normalised.month, `from ${month}`).toBeLessThanOrEqual(monthsInYear());
    }
  });
});

describe("a calendar anchored to the present", () => {
  const LENGTHS = [31, 30, 31, 30, 31, 30, 31, 30, 30, 30, 30, 31];
  const WEEKDAYS = ["Verdrag", "Eldora", "Thalorin", "Drusten", "Mithralis", "Sylvain", "Solara"];

  // 14 April 2025 was a Monday, and 21:30 is deliberately not midnight: the anchor has to carry
  // both the hour and the weekday across, or switching calendars moves more than the names.
  const ANCHOR = at(2025, 4, 14, 21, 30);

  const tarlan = parseCalendar({
    name: "Tarlan",
    era: "TR",
    yearOffset: 0,
    months: LENGTHS.map((days, index) => ({ name: `Month${index + 1}`, days })),
    weekdays: WEEKDAYS,
    seasons: [],
    festivals: [{ month: 1, day: 1, name: "Renewal" }],
    epoch: { on: "2025-04-14T21:30:00Z", year: 1000, month: 1, day: 1 },
  }) as CalendarDefinition;

  afterEach(() => setCalendar(BUNDLED_CALENDAR));

  it("reads the anchor instant as the anchor date, at the same hour and weekday", () => {
    setCalendar(tarlan);
    expect(getWorldDate(ANCHOR)).toMatchObject({
      year: 1000,
      month: 1,
      day: 1,
      hour: 21,
      minute: 30,
      weekdayIndex: 0,
      monthName: "Month1",
      weekdayName: "Verdrag",
      era: "TR",
      daysInYear: 365,
      festival: "Renewal",
    });
  });

  it("leaves the clock reading what the Gregorian structure read at the same instant", () => {
    const gregorian = getWorldDate(ANCHOR);
    setCalendar(tarlan);
    const tarlanDate = getWorldDate(ANCHOR);
    expect(tarlanDate.hour).toBe(gregorian.hour);
    expect(tarlanDate.minute).toBe(gregorian.minute);
    expect(tarlanDate.weekdayIndex).toBe(gregorian.weekdayIndex);
  });

  // Preserving the hour is the same statement as "the day starts where UTC's does", which is what
  // every jump button already assumes.
  it("starts its day at the same instant the Gregorian day starts", () => {
    setCalendar(tarlan);
    expect(startOfDayWorldTime(ANCHOR)).toBe(at(2025, 4, 14));
    expect(getWorldDate(startOfDayWorldTime(ANCHOR)).hour).toBe(0);
  });

  it("sets a time of day off its own day boundary", () => {
    setCalendar(tarlan);
    // 21:30, asking for 06:00: this morning, 15h30m back.
    expect(secondsToTimeOfDay(ANCHOR, 6 * 60)).toBe(-(15 * HOUR + 30 * 60));
  });

  it("resolves a date back into a world time, and its month's shape", () => {
    setCalendar(tarlan);

    // The anchor itself: 2025-04-14 was a Monday, so Month1 1 of 1000 starts on weekday 0.
    expect(worldTimeAtDate(1000, 1, 1)).toBe(at(2025, 4, 14));
    expect(monthShape(1000, 1)).toMatchObject({ year: 1000, month: 1, days: 31, firstWeekdayIndex: 0 });

    // Its own lengths, not the Gregorian ones — month 2 is 30 days where February would be 28.
    expect(LENGTHS.map((_, index) => monthShape(1000, index + 1).days)).toEqual(LENGTHS);

    // And the inverse holds for a date in the middle of the year, keeping the time of day.
    const noon = worldTimeAtDate(1000, 7, 15, 12 * HOUR);
    expect(getWorldDate(noon)).toMatchObject({ year: 1000, month: 7, day: 15, hour: 12 });
  });

  it("reckons a year before its own epoch", () => {
    setCalendar(tarlan);
    // Years run continuously with no gap at zero, so navigating back past the anchor is arithmetic.
    const before = worldTimeAtDate(999, 12, 31);
    expect(before).toBeLessThan(worldTimeAtDate(1000, 1, 1));
    expect(getWorldDate(before)).toMatchObject({ year: 999, month: 12, day: 31 });
  });

  it("advances the date without a 32nd day or a February", () => {
    setCalendar(tarlan);
    for (let index = 0; index < 365; index += 1) {
      const date = getWorldDate(ANCHOR + index * DAY);
      expect(date.day).toBeLessThanOrEqual(LENGTHS[date.month - 1]!);
      expect(date.day).toBeGreaterThanOrEqual(1);
    }
    expect(getWorldDate(ANCHOR + 365 * DAY)).toMatchObject({ year: 1001, month: 1, day: 1 });
  });

  it("agrees with the key resolving the same date would carry, without a time of day", () => {
    setCalendar(tarlan);
    expect(dayKeyAt(1000, 7, 15)).toBe(getWorldDate(worldTimeAtDate(1000, 7, 15)).dayKey);

    setCalendar(BUNDLED_CALENDAR);
    expect(dayKeyAt(4725, 12, 8)).toBe(getWorldDate(worldTimeAtDate(4725, 12, 8)).dayKey);
  });
});
