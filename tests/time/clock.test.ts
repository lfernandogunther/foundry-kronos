import { afterEach, describe, expect, it } from "vitest";

import { BUNDLED_CALENDAR, type CalendarDefinition, parseCalendar, setCalendar } from "../../src/time/calendar.js";
import {
  dateKeyOf,
  describeGregorian,
  getWorldDate,
  secondsUntilTimeOfDay,
  startOfDayWorldTime,
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

describe("dateKeyOf", () => {
  const keyAt = (utcMs: number, calendar = BUNDLED_CALENDAR): string =>
    dateKeyOf(describeGregorian(utcMs, calendar, 0));

  it("is stable across times within the same day", () => {
    expect(keyAt(Date.UTC(2025, 11, 8, 0, 1))).toBe(keyAt(Date.UTC(2025, 11, 8, 23, 59)));
  });

  it("changes across midnight", () => {
    expect(keyAt(Date.UTC(2025, 11, 8, 23, 59))).not.toBe(keyAt(Date.UTC(2025, 11, 9, 0, 0)));
  });

  it("pads the month and day so it stays sortable", () => {
    expect(keyAt(Date.UTC(2025, 0, 5))).toBe("Golarion — Absalom Reckoning:4725-01-05");
  });

  // Two calendars label the same instant differently; without the name in the key, a GM's override
  // on one calendar's day would surface on the other's.
  it("cannot collide across calendars that agree on the numbers", () => {
    const twin = { ...BUNDLED_CALENDAR, name: "A different reckoning" };
    expect(keyAt(Date.UTC(2025, 0, 5))).not.toBe(keyAt(Date.UTC(2025, 0, 5), twin));
  });
});

describe("secondsUntilTimeOfDay over the Gregorian structure", () => {
  it("moves forward within the same day", () => {
    // 08:00, jumping to noon.
    expect(secondsUntilTimeOfDay(at(2025, 6, 15, 8, 0), 12 * 60)).toBe(4 * HOUR);
  });

  it("rolls into tomorrow rather than rewinding", () => {
    // 14:00, asking for 06:00 — that is tomorrow morning, 16 hours ahead.
    expect(secondsUntilTimeOfDay(at(2025, 6, 15, 14, 0), 6 * 60)).toBe(16 * HOUR);
  });

  it("treats the current instant as a full day away, never as zero", () => {
    // Standing exactly on noon and asking for noon should advance a day, not do nothing.
    expect(secondsUntilTimeOfDay(at(2025, 6, 15, 12, 0), 12 * 60)).toBe(DAY);
  });

  it("never returns a negative delta, at any time of day", () => {
    for (let minute = 0; minute < 1440; minute += 7) {
      for (const target of [0, 245, 720, 1195, 1439]) {
        expect(secondsUntilTimeOfDay(at(2025, 6, 15) + minute * 60, target)).toBeGreaterThan(0);
      }
    }
  });

  it("handles a fractional target time", () => {
    // 04:05 sunrise from midnight.
    expect(secondsUntilTimeOfDay(at(2025, 6, 15, 0, 0), 244.86)).toBe(14_692);
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

  it("jumps to a time of day off its own day boundary", () => {
    setCalendar(tarlan);
    // 21:30, asking for 06:00: tomorrow morning, 8h30m ahead.
    expect(secondsUntilTimeOfDay(ANCHOR, 6 * 60)).toBe(8 * HOUR + 30 * 60);
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
});
