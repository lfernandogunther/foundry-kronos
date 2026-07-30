import { describe, expect, it } from "vitest";

import { minutesAt, timeLabel, timelineLayout, type TimelineTarget } from "../../src/apps/timeline.js";
import { BUNDLED_CALENDAR } from "../../src/time/calendar.js";
import { describeGregorian, type WorldDate } from "../../src/time/clock.js";
import { solarEvents } from "../../src/time/sun.js";

/** The latitude the module defaults to, central Europe. */
const LATITUDE = 48;

const dateAt = (month: number, day: number, hour = 0, minute = 0): WorldDate =>
  describeGregorian(Date.UTC(2025, month - 1, day, hour, minute), BUNDLED_CALENDAR, 0);

const markerFor = (date: WorldDate, target: TimelineTarget, latitude = LATITUDE) =>
  timelineLayout(date, latitude).markers.find((entry) => entry.target === target)!;

describe("the handle", () => {
  it("sits at the left edge at midnight and the middle at noon", () => {
    expect(timelineLayout(dateAt(6, 15, 0, 0), LATITUDE).percent).toBe(0);
    expect(timelineLayout(dateAt(6, 15, 12, 0), LATITUDE).percent).toBe(50);
  });

  it("reaches the right edge without passing it at the last minute of the day", () => {
    const percent = timelineLayout(dateAt(6, 15, 23, 59), LATITUDE).percent;
    expect(percent).toBeGreaterThan(99);
    expect(percent).toBeLessThanOrEqual(100);
  });

  it("moves monotonically through the day", () => {
    let previous = -1;
    for (let hour = 0; hour < 24; hour += 1) {
      const percent = timelineLayout(dateAt(6, 15, hour), LATITUDE).percent;
      expect(percent).toBeGreaterThan(previous);
      previous = percent;
    }
  });
});

describe("the markers", () => {
  it("places sunrise and sunset where the solar model puts them", () => {
    // The point of the whole file: the marker's fraction of the bar has to be the sun's fraction of
    // the day, or the timeline quietly misreports when it gets light.
    const date = dateAt(6, 15);
    const events = solarEvents(date.dayOfYear, LATITUDE);

    // Unrounded: the target keeps the solar model's precision so the clock lands on the right
    // second, and only the printed label rounds to the minute.
    expect(markerFor(date, "sunrise").minutes).toBe(events.sunrise);
    expect(markerFor(date, "sunset").minutes).toBe(events.sunset);
    expect(markerFor(date, "sunrise").percent).toBeCloseTo((events.sunrise / 1440) * 100, 4);
    expect(markerFor(date, "sunset").percent).toBeCloseTo((events.sunset / 1440) * 100, 4);
    expect(markerFor(date, "sunrise").label).toBe(timeLabel(events.sunrise));
  });

  it("moves sunrise earlier and sunset later between midwinter and midsummer", () => {
    const winter = markerFor(dateAt(12, 21), "sunrise").percent;
    const summer = markerFor(dateAt(6, 21), "sunrise").percent;
    expect(summer).toBeLessThan(winter);

    expect(markerFor(dateAt(6, 21), "sunset").percent).toBeGreaterThan(markerFor(dateAt(12, 21), "sunset").percent);
  });

  it("pins midnight, noon and the end of the day", () => {
    const date = dateAt(6, 15);
    expect(markerFor(date, "midnight")).toMatchObject({ minutes: 0, percent: 0, label: "00:00" });
    expect(markerFor(date, "noon")).toMatchObject({ minutes: 720, percent: 50, label: "12:00" });

    // Labelled as the end of the day, set a minute short of it: at 24:00 the gesture would land on
    // tomorrow and change the date, which no gesture on a one-day bar may do.
    expect(markerFor(date, "endOfDay")).toMatchObject({ minutes: 1439, percent: 100, label: "24:00" });
  });

  it("keeps every marker on the bar and in order, all year and at every latitude", () => {
    for (const latitude of [-66, -48, -23, 0, 23, 48, 66]) {
      for (const [month, day] of [
        [1, 1],
        [3, 20],
        [6, 21],
        [9, 22],
        [12, 21],
      ] as const) {
        const { markers } = timelineLayout(dateAt(month, day), latitude);
        const where = `latitude ${latitude}, ${day}/${month}`;

        for (const entry of markers) {
          expect(Number.isFinite(entry.percent), `${entry.target} at ${where}`).toBe(true);
          expect(entry.percent, `${entry.target} at ${where}`).toBeGreaterThanOrEqual(0);
          expect(entry.percent, `${entry.target} at ${where}`).toBeLessThanOrEqual(100);
          expect(entry.minutes, `${entry.target} at ${where}`).toBeLessThanOrEqual(1439);
        }

        const percents = markers.map((entry) => entry.percent);
        expect([...percents].sort((a, b) => a - b), where).toEqual(percents);
      }
    }
  });

  it("survives a polar day and a polar night", () => {
    // Beyond the Arctic Circle the sun does not cross the horizon; solarEvents returns nominal
    // times, and the markers still have to be placeable numbers.
    //
    // A polar day nominates minute 1440 as sunset, which is the next day's midnight — clicking a
    // marker there would move the date, which is exactly what the timeline must never do. So the
    // bound is asserted, not only the absence of a NaN.
    for (const latitude of [66, 80, -80]) {
      for (const [month, day] of [
        [6, 21],
        [12, 21],
      ] as const) {
        const { markers } = timelineLayout(dateAt(month, day), latitude);
        for (const entry of markers) {
          const where = `${entry.target} at latitude ${latitude}, ${day}/${month}`;
          expect(Number.isNaN(entry.percent), where).toBe(false);
          expect(entry.minutes, where).toBeGreaterThanOrEqual(0);
          expect(entry.minutes, where).toBeLessThanOrEqual(1439);
        }
      }
    }
  });

  it("gives each marker a single-character icon", () => {
    for (const entry of timelineLayout(dateAt(6, 15), LATITUDE).markers) {
      expect([...entry.icon], entry.target).toHaveLength(1);
    }
  });
});

describe("reading a position on the bar", () => {
  it("maps the ends of the bar to the ends of the day", () => {
    expect(minutesAt(0)).toBe(0);
    expect(minutesAt(1)).toBe(1439);
  });

  it("maps the middle of the bar to noon", () => {
    expect(minutesAt(0.5)).toBe(720);
  });

  it("clamps a pointer dragged off either end", () => {
    expect(minutesAt(-0.4)).toBe(0);
    expect(minutesAt(1.7)).toBe(1439);
  });

  it("never leaves the day, so a drag cannot change the date", () => {
    for (let step = -20; step <= 120; step += 1) {
      const minutes = minutesAt(step / 100);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThanOrEqual(1439);
    }
  });
});

describe("timeLabel", () => {
  it("pads both halves", () => {
    expect(timeLabel(0)).toBe("00:00");
    expect(timeLabel(65)).toBe("01:05");
    expect(timeLabel(1439)).toBe("23:59");
  });

  it("rounds a fractional solar time to the nearest minute", () => {
    expect(timeLabel(244.86)).toBe("04:05");
  });
});
