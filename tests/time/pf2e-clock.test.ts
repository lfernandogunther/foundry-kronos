import { describe, expect, it } from "vitest";

import { BUNDLED_LABELS, isCalendarLabels } from "../../src/time/calendar.js";
import { dateKeyOf, describeUtcMs } from "../../src/time/pf2e-clock.js";

describe("bundled Golarion labels", () => {
  it("are a valid label set", () => {
    expect(isCalendarLabels(BUNDLED_LABELS)).toBe(true);
  });

  it("carry the Absalom Reckoning offset", () => {
    expect(BUNDLED_LABELS.yearOffset).toBe(2700);
    expect(BUNDLED_LABELS.era).toBe("AR");
  });
});

describe("isCalendarLabels", () => {
  it("rejects a set with the wrong number of months", () => {
    expect(isCalendarLabels({ ...BUNDLED_LABELS, months: BUNDLED_LABELS.months.slice(0, 11) })).toBe(false);
  });

  it("rejects a set with the wrong number of weekdays", () => {
    expect(isCalendarLabels({ ...BUNDLED_LABELS, weekdays: [...BUNDLED_LABELS.weekdays, "Extraday"] })).toBe(false);
  });

  it("rejects a missing year offset", () => {
    const { yearOffset: _dropped, ...withoutOffset } = BUNDLED_LABELS;
    expect(isCalendarLabels(withoutOffset)).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isCalendarLabels(null)).toBe(false);
    expect(isCalendarLabels("Golarion")).toBe(false);
  });
});

describe("describeUtcMs", () => {
  // 8 December 2025 was a Monday, so this is the mockup's reading in real Golarion terms.
  const sample = Date.UTC(2025, 11, 8, 11, 15, 0);
  const date = describeUtcMs(sample, BUNDLED_LABELS, 0);

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
    const sunday = describeUtcMs(Date.UTC(2025, 11, 7), BUNDLED_LABELS, 0);
    expect(sunday.weekdayIndex).toBe(6);
    expect(sunday.weekdayName).toBe("Sunday");
  });
});

describe("dateKeyOf", () => {
  it("is stable across times within the same day", () => {
    const labels = BUNDLED_LABELS;
    const morning = dateKeyOf(describeUtcMs(Date.UTC(2025, 11, 8, 0, 1), labels, 0));
    const night = dateKeyOf(describeUtcMs(Date.UTC(2025, 11, 8, 23, 59), labels, 0));
    expect(morning).toBe(night);
    expect(morning).toBe("2025-12-08");
  });

  it("changes across midnight", () => {
    const labels = BUNDLED_LABELS;
    const before = dateKeyOf(describeUtcMs(Date.UTC(2025, 11, 8, 23, 59), labels, 0));
    const after = dateKeyOf(describeUtcMs(Date.UTC(2025, 11, 9, 0, 0), labels, 0));
    expect(before).not.toBe(after);
  });

  it("uses the underlying year so it stays sortable regardless of era", () => {
    const key = dateKeyOf(describeUtcMs(Date.UTC(2025, 0, 5), BUNDLED_LABELS, 0));
    expect(key).toBe("2025-01-05");
  });
});
