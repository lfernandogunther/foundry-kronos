import { afterEach, describe, expect, it } from "vitest";

import { monthView } from "../../src/apps/month-grid.js";
import { BUNDLED_CALENDAR, bundledCalendar, setCalendar } from "../../src/time/calendar.js";
import { dayKeyAt, getWorldDate, worldTimeAtDate } from "../../src/time/clock.js";

/** The test world was created at the Unix epoch, so a world time is seconds since 1970. */
const at = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d) / 1000;

const golarionToday = getWorldDate(at(2025, 12, 8));

afterEach(() => setCalendar(BUNDLED_CALENDAR));

describe("the columns mean something", () => {
  /**
   * The property the design reference does not hold: laid out in a grid of `weekdays.length` columns,
   * every day must land in the column of the weekday it actually falls on.
   *
   * The reference lists days from the first column regardless, so its headers are decoration. This is
   * the assertion that keeps ours honest, and it is checked against the date arithmetic rather than
   * against `blanks` itself — otherwise it would only be restating the implementation.
   */
  const everyDayIsUnderItsWeekday = (year: number, month: number): void => {
    const view = monthView(year, month, golarionToday, null);
    const columns = view.weekdays.length;

    for (const { day } of view.days) {
      const column = (view.blanks + day - 1) % columns;
      const actual = getWorldDate(worldTimeAtDate(view.year, view.month, day)).weekdayIndex;
      expect(column, `${day}/${view.month}/${view.year} sits in column ${column}, weekday ${actual}`).toBe(actual);
    }
  };

  it("holds for every month of a Gregorian year", () => {
    for (let month = 1; month <= 12; month += 1) everyDayIsUnderItsWeekday(4725, month);
  });

  it("holds across a leap year", () => {
    for (let month = 1; month <= 12; month += 1) everyDayIsUnderItsWeekday(4724, month);
  });

  it("holds for a calendar with months of its own", () => {
    setCalendar(bundledCalendar("tarlan"));
    for (let month = 1; month <= 12; month += 1) everyDayIsUnderItsWeekday(1000, month);
  });
});

describe("the month view", () => {
  it("names the month and the weekdays from the calendar", () => {
    const view = monthView(4725, 12, golarionToday, null);
    expect(view.monthName).toBe("Kuthona");
    expect(view.weekdays).toHaveLength(7);
    expect(view.weekdays[0]).toBe("Moonday");
  });

  it("has one entry per day, numbered from one", () => {
    const view = monthView(4725, 12, golarionToday, null);
    expect(view.days).toHaveLength(31);
    expect(view.days.map((entry) => entry.day)).toEqual([...Array(31)].map((_, index) => index + 1));
  });

  it("gives February its real length", () => {
    expect(monthView(4724, 2, golarionToday, null).days).toHaveLength(29);
    expect(monthView(4725, 2, golarionToday, null).days).toHaveLength(28);
  });

  it("wraps a month past the end of the year into the next one", () => {
    expect(monthView(4725, 13, golarionToday, null)).toMatchObject({ year: 4726, month: 1 });
    expect(monthView(4725, 0, golarionToday, null)).toMatchObject({ year: 4724, month: 12 });
  });

  it("carries the calendar's own months and weekdays", () => {
    setCalendar(bundledCalendar("tarlan"));
    const view = monthView(1000, 1, getWorldDate(at(2025, 1, 1)), null);
    expect(view.monthName).toBe("Enudar");
    expect(view.days).toHaveLength(31);
    expect(view.weekdays[0]).toBe("Verdrag");
  });
});

describe("today", () => {
  it("is marked, once, in the month it falls in", () => {
    const view = monthView(4725, 12, golarionToday, null);
    expect(view.days.filter((entry) => entry.isToday).map((entry) => entry.day)).toEqual([8]);
  });

  it("is marked nowhere in another month", () => {
    for (const [year, month] of [
      [4725, 11],
      [4726, 12],
      [4724, 12],
    ] as const) {
      const view = monthView(year, month, golarionToday, null);
      expect(view.days.some((entry) => entry.isToday), `${month}/${year}`).toBe(false);
    }
  });
});

describe("the selection", () => {
  it("marks the day it names, and only that one", () => {
    const view = monthView(4725, 12, golarionToday, 20);
    expect(view.selected).toBe(20);
    expect(view.days.filter((entry) => entry.isSelected).map((entry) => entry.day)).toEqual([20]);
  });

  it("is dropped rather than clamped when the month is too short for it", () => {
    // Moving from a 31-day month to February with the 31st selected. Clamping to the 28th would
    // quietly mean a different day than the one that was clicked.
    const view = monthView(4725, 2, golarionToday, 31);
    expect(view.selected).toBeNull();
    expect(view.days.some((entry) => entry.isSelected)).toBe(false);
  });

  it("survives into a month long enough to hold it", () => {
    expect(monthView(4725, 2, golarionToday, 28).selected).toBe(28);
    expect(monthView(4724, 2, golarionToday, 29).selected).toBe(29);
    expect(monthView(4725, 2, golarionToday, 29).selected).toBeNull();
  });

  it("rejects a day number that is not one", () => {
    for (const selected of [0, -3]) {
      expect(monthView(4725, 12, golarionToday, selected).selected, String(selected)).toBeNull();
    }
  });
});

describe("the note marker", () => {
  it("marks only the day a key in the map names", () => {
    const key = dayKeyAt(4725, 12, 20);
    const view = monthView(4725, 12, golarionToday, null, { [key]: "The party is due back." });
    expect(view.days.filter((entry) => entry.hasNote).map((entry) => entry.day)).toEqual([20]);
  });

  it("marks nothing when the map is empty", () => {
    const view = monthView(4725, 12, golarionToday, null, {});
    expect(view.days.some((entry) => entry.hasNote)).toBe(false);
  });

  it("does not mark a key present but blank", () => {
    const key = dayKeyAt(4725, 12, 20);
    const view = monthView(4725, 12, golarionToday, null, { [key]: "   " });
    expect(view.days.some((entry) => entry.hasNote)).toBe(false);
  });

  it("does not mark a day in a different month, even under the same key namespace", () => {
    const key = dayKeyAt(4725, 11, 20);
    const view = monthView(4725, 12, golarionToday, null, { [key]: "November's note" });
    expect(view.days.some((entry) => entry.hasNote)).toBe(false);
  });
});
