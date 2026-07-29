import { describe, expect, it } from "vitest";

import { BUNDLED_CALENDAR, parseCalendar } from "../../src/time/calendar.js";
import { dateKeyOf, describeUtcMs } from "../../src/time/pf2e-clock.js";

describe("the bundled Golarion calendar", () => {
  it("carries the Absalom Reckoning offset", () => {
    expect(BUNDLED_CALENDAR.yearOffset).toBe(2700);
    expect(BUNDLED_CALENDAR.era).toBe("AR");
  });

  it("uses the Gregorian structure rather than stating its own month lengths", () => {
    expect(BUNDLED_CALENDAR.monthDays).toBeNull();
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

describe("describeUtcMs", () => {
  // 8 December 2025 was a Monday, so this is the mockup's reading in real Golarion terms.
  const sample = Date.UTC(2025, 11, 8, 11, 15, 0);
  const date = describeUtcMs(sample, BUNDLED_CALENDAR, 0);

  it("applies the era offset to the displayed year", () => {
    expect(date.gregorianYear).toBe(2025);
    expect(date.year).toBe(4725);
    expect(date.era).toBe("AR");
  });

  it("names the month from the label set", () => {
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
  });

  it("maps a Sunday onto the last weekday of the list", () => {
    // 7 December 2025, the day before the sample.
    const sunday = describeUtcMs(Date.UTC(2025, 11, 7), BUNDLED_CALENDAR, 0);
    expect(sunday.weekdayIndex).toBe(6);
    expect(sunday.weekdayName).toBe("Sunday");
  });
});

describe("dateKeyOf", () => {
  it("is stable across times within the same day", () => {
    const labels = BUNDLED_CALENDAR;
    const morning = dateKeyOf(describeUtcMs(Date.UTC(2025, 11, 8, 0, 1), labels, 0));
    const night = dateKeyOf(describeUtcMs(Date.UTC(2025, 11, 8, 23, 59), labels, 0));
    expect(morning).toBe(night);
    expect(morning).toBe("2025-12-08");
  });

  it("changes across midnight", () => {
    const labels = BUNDLED_CALENDAR;
    const before = dateKeyOf(describeUtcMs(Date.UTC(2025, 11, 8, 23, 59), labels, 0));
    const after = dateKeyOf(describeUtcMs(Date.UTC(2025, 11, 9, 0, 0), labels, 0));
    expect(before).not.toBe(after);
  });

  it("uses the underlying year so it stays sortable regardless of era", () => {
    const key = dateKeyOf(describeUtcMs(Date.UTC(2025, 0, 5), BUNDLED_CALENDAR, 0));
    expect(key).toBe("2025-01-05");
  });
});
