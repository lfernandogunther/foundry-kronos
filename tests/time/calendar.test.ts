import { describe, expect, it } from "vitest";

import { BUNDLED_CALENDAR, daysInCalendarYear, hasOwnMonths, parseCalendar } from "../../src/time/calendar.js";

describe("the bundled Golarion calendar", () => {
  it("carries the Absalom Reckoning offset", () => {
    expect(BUNDLED_CALENDAR.yearOffset).toBe(2700);
    expect(BUNDLED_CALENDAR.era).toBe("AR");
  });

  it("uses the Gregorian structure rather than stating its own month lengths", () => {
    expect(BUNDLED_CALENDAR.monthDays).toBeNull();
    expect(hasOwnMonths(BUNDLED_CALENDAR)).toBe(false);
    expect(daysInCalendarYear(BUNDLED_CALENDAR)).toBe(365);
  });

  it("inherits the default season boundaries", () => {
    expect(BUNDLED_CALENDAR.seasons).toContainEqual({ month: 3, day: 20, season: "spring" });
    expect(BUNDLED_CALENDAR.seasons).toHaveLength(4);
  });
});

describe("parseCalendar", () => {
  /** The shape a calendar file actually has, before normalisation fills anything in. */
  const raw = {
    name: "Golarion",
    era: "AR",
    yearOffset: 2700,
    months: BUNDLED_CALENDAR.months,
    weekdays: BUNDLED_CALENDAR.weekdays,
  };

  it("accepts month names alone as the Gregorian structure", () => {
    const parsed = parseCalendar(raw);
    expect(parsed?.monthDays).toBeNull();
    expect(parsed?.months).toEqual(BUNDLED_CALENDAR.months);
  });

  it("reads month lengths when the months carry them", () => {
    const parsed = parseCalendar({
      ...raw,
      months: [
        { name: "Enudar", days: 31 },
        { name: "Halveris", days: 30 },
      ],
      weekdays: ["Verdrag", "Eldora"],
      seasons: [],
    });
    expect(parsed?.monthDays).toEqual([31, 30]);
    expect(parsed?.months).toEqual(["Enudar", "Halveris"]);
  });

  it("rejects the Gregorian structure with the wrong number of months", () => {
    expect(parseCalendar({ ...raw, months: raw.months.slice(0, 11) })).toBeNull();
  });

  it("rejects the Gregorian structure with the wrong number of weekdays", () => {
    expect(parseCalendar({ ...raw, weekdays: [...raw.weekdays, "Extraday"] })).toBeNull();
  });

  it("allows any month and weekday count once lengths are stated", () => {
    const parsed = parseCalendar({
      ...raw,
      months: [{ name: "Onlymonth", days: 40 }],
      weekdays: ["Onlyday", "Otherday", "Thirdday"],
      seasons: [],
    });
    expect(parsed?.monthDays).toEqual([40]);
  });

  it("rejects a missing year offset", () => {
    const { yearOffset: _dropped, ...withoutOffset } = raw;
    expect(parseCalendar(withoutOffset)).toBeNull();
  });

  it("rejects a month whose day count is not a positive integer", () => {
    expect(parseCalendar({ ...raw, months: [{ name: "Enudar", days: 0 }], seasons: [] })).toBeNull();
    expect(parseCalendar({ ...raw, months: [{ name: "Enudar", days: 30.5 }], seasons: [] })).toBeNull();
  });

  it("rejects a season or festival day past the end of its month", () => {
    const months = [{ name: "Short", days: 30 }];
    expect(parseCalendar({ ...raw, months, seasons: [{ month: 1, day: 31, season: "spring" }] })).toBeNull();
    expect(parseCalendar({ ...raw, months, seasons: [], festivals: [{ month: 1, day: 31, name: "Too late" }] })).toBeNull();
  });

  it("rejects an unknown season name", () => {
    expect(parseCalendar({ ...raw, seasons: [{ month: 1, day: 1, season: "monsoon" }] })).toBeNull();
  });

  it("rejects an epoch whose instant cannot be parsed", () => {
    const epoch = { on: "not a date", year: 1000, month: 1, day: 1 };
    expect(parseCalendar({ ...raw, epoch })).toBeNull();
  });

  it("accepts an epoch without an instant, anchoring at world time zero", () => {
    const parsed = parseCalendar({ ...raw, epoch: { year: 1000, month: 1, day: 1 } });
    expect(parsed?.epoch).toEqual({ on: null, year: 1000, month: 1, day: 1 });
  });

  it("rejects non-objects", () => {
    expect(parseCalendar(null)).toBeNull();
    expect(parseCalendar("Golarion")).toBeNull();
  });
});

