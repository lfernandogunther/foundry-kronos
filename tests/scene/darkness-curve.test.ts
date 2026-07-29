import { describe, expect, it } from "vitest";

import { darknessAt, DEFAULT_PROFILE, isWorthWriting } from "../../src/scene/darkness-curve.js";
import { solarEvents } from "../../src/time/sun.js";

const EUROPE_LAT = 48;
const SUMMER_SOLSTICE = 172;
const WINTER_SOLSTICE = 355;
const EQUINOX = 81;

describe("plateaus", () => {
  it("is fully dark at midnight and fully light at midday", () => {
    expect(darknessAt(0, EQUINOX, EUROPE_LAT)).toBe(1);
    expect(darknessAt(12 * 60, EQUINOX, EUROPE_LAT)).toBe(0);
  });

  it("holds the night value through the small hours", () => {
    for (const minute of [0, 60, 120, 180]) {
      expect(darknessAt(minute, WINTER_SOLSTICE, EUROPE_LAT)).toBe(1);
    }
  });

  it("respects a custom profile", () => {
    const gloomy = { night: 0.8, day: 0.3, twilightMinutes: 90 };
    expect(darknessAt(0, EQUINOX, EUROPE_LAT, gloomy)).toBe(0.8);
    expect(darknessAt(12 * 60, EQUINOX, EUROPE_LAT, gloomy)).toBe(0.3);
  });
});

describe("the ramps", () => {
  it("sits halfway at sunrise and at sunset", () => {
    const { sunrise, sunset } = solarEvents(EQUINOX, EUROPE_LAT);
    expect(darknessAt(sunrise, EQUINOX, EUROPE_LAT)).toBeCloseTo(0.5, 2);
    expect(darknessAt(sunset, EQUINOX, EUROPE_LAT)).toBeCloseTo(0.5, 2);
  });

  it("falls without reversing across the whole dawn", () => {
    const { sunrise } = solarEvents(EQUINOX, EUROPE_LAT);
    const start = Math.floor(sunrise - DEFAULT_PROFILE.twilightMinutes);
    let previous = darknessAt(start, EQUINOX, EUROPE_LAT);
    for (let m = start + 1; m <= sunrise + DEFAULT_PROFILE.twilightMinutes; m++) {
      const value = darknessAt(m, EQUINOX, EUROPE_LAT);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it("eases rather than running straight", () => {
    // A linear ramp would put the quarter point at exactly 0.25 of the way through.
    const { sunrise } = solarEvents(EQUINOX, EUROPE_LAT);
    const quarter = sunrise - DEFAULT_PROFILE.twilightMinutes / 4;
    expect(darknessAt(quarter, EQUINOX, EUROPE_LAT)).toBeGreaterThan(0.8);
  });

  it("stays within the profile's bounds all day", () => {
    for (let minute = 0; minute < 1440; minute++) {
      const value = darknessAt(minute, EQUINOX, EUROPE_LAT);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("seasons", () => {
  it("is dark at 18:00 in midwinter and light at 18:00 in midsummer", () => {
    const evening = 18 * 60;
    expect(darknessAt(evening, WINTER_SOLSTICE, EUROPE_LAT)).toBe(1);
    expect(darknessAt(evening, SUMMER_SOLSTICE, EUROPE_LAT)).toBe(0);
  });

  it("gives midsummer more full daylight than midwinter", () => {
    const litMinutes = (day: number): number => {
      let count = 0;
      for (let m = 0; m < 1440; m++) if (darknessAt(m, day, EUROPE_LAT) === 0) count++;
      return count;
    };
    expect(litMinutes(SUMMER_SOLSTICE)).toBeGreaterThan(litMinutes(WINTER_SOLSTICE) + 240);
  });
});

describe("extreme latitudes", () => {
  it("stays light all day under the midnight sun", () => {
    for (const minute of [0, 360, 720, 1080]) {
      expect(darknessAt(minute, SUMMER_SOLSTICE, 80)).toBe(0);
    }
  });

  it("stays dark all day through polar night", () => {
    for (const minute of [0, 360, 720, 1080]) {
      expect(darknessAt(minute, WINTER_SOLSTICE, 80)).toBe(1);
    }
  });
});

describe("isWorthWriting", () => {
  it("ignores changes below the threshold", () => {
    expect(isWorthWriting(0.5, 0.5)).toBe(false);
    expect(isWorthWriting(0.5, 0.505)).toBe(false);
  });

  it("accepts a real change", () => {
    expect(isWorthWriting(0.5, 0.6)).toBe(true);
    expect(isWorthWriting(1, 0)).toBe(true);
  });

  it("produces no writes across a night plateau but several across dawn", () => {
    const sample = (from: number, to: number): number => {
      let writes = 0;
      let last = darknessAt(from, EQUINOX, EUROPE_LAT);
      for (let m = from; m <= to; m += 10) {
        const next = darknessAt(m, EQUINOX, EUROPE_LAT);
        if (isWorthWriting(last, next)) {
          writes++;
          last = next;
        }
      }
      return writes;
    };

    const { sunrise } = solarEvents(EQUINOX, EUROPE_LAT);
    expect(sample(0, 180)).toBe(0);
    expect(sample(Math.floor(sunrise) - 45, Math.floor(sunrise) + 45)).toBeGreaterThan(2);
  });
});
