import { describe, expect, it } from "vitest";

import type { Season } from "../../src/time/season.js";
import {
  generateDailyWeather,
  isWeatherCondition,
  TEMPERATE_EUROPE,
  temperatureAt,
  WEATHER_CONDITIONS,
} from "../../src/weather/generator.js";

const midwinter = { season: "winter" as Season, summerness: 0 };
const midsummer = { season: "summer" as Season, summerness: 1 };

describe("determinism", () => {
  it("gives the same weather for the same day, every time", () => {
    const first = generateDailyWeather("2025-12-08", midwinter.season, midwinter.summerness);
    const second = generateDailyWeather("2025-12-08", midwinter.season, midwinter.summerness);
    expect(second).toEqual(first);
  });

  it("gives different days different weather", () => {
    const days = Array.from({ length: 30 }, (_, i) =>
      generateDailyWeather(`2025-06-${String(i + 1).padStart(2, "0")}`, midsummer.season, midsummer.summerness),
    );
    const distinct = new Set(days.map((d) => `${d.condition}|${d.tempMin}|${d.tempMax}`));
    // Not asking for 30 unique results, just that it is not emitting one value forever.
    expect(distinct.size).toBeGreaterThan(10);
  });
});

describe("temperature envelope", () => {
  it("is colder in winter than in summer", () => {
    const winter = generateDailyWeather("2025-01-15", midwinter.season, midwinter.summerness);
    const summer = generateDailyWeather("2025-01-15", midsummer.season, midsummer.summerness);
    expect(winter.tempMax).toBeLessThan(summer.tempMax);
  });

  it("keeps the daily maximum above the minimum", () => {
    for (let day = 1; day <= 28; day++) {
      const key = `2025-02-${String(day).padStart(2, "0")}`;
      const weather = generateDailyWeather(key, midwinter.season, midwinter.summerness);
      expect(weather.tempMax).toBeGreaterThan(weather.tempMin);
    }
  });

  it("stays inside the climate profile plus its stated variance", () => {
    const { winterLow, summerHigh, dailyVariance } = TEMPERATE_EUROPE;
    for (let day = 1; day <= 28; day++) {
      const key = `2025-03-${String(day).padStart(2, "0")}`;
      const weather = generateDailyWeather(key, "spring", 0.5);
      expect(weather.tempMin).toBeGreaterThanOrEqual(winterLow - dailyVariance - 1);
      expect(weather.tempMax).toBeLessThanOrEqual(summerHigh + dailyVariance + 1);
    }
  });
});

describe("condition coherence", () => {
  it("never reports snow on a warm day", () => {
    // Winter weights with a summer temperature envelope: an unnatural combination, chosen because
    // it is the only way to make snow *likely* to be rolled on a day too warm for it. Testing this
    // against a real summer day would prove nothing — summer never rolls snow to begin with.
    let warmSnowRolls = 0;
    for (let day = 1; day <= 60; day++) {
      const weather = generateDailyWeather(`warm-${day}`, "winter", 1);
      expect(weather.condition).not.toBe("snow");
      if (weather.condition === "rain") warmSnowRolls++;
    }
    // Confirms the branch above was actually reached rather than passing by never rolling snow.
    expect(warmSnowRolls).toBeGreaterThan(0);
  });

  it("never reports rain when the day never rises above freezing", () => {
    for (let day = 1; day <= 31; day++) {
      const key = `2025-01-${String(day).padStart(2, "0")}`;
      const weather = generateDailyWeather(key, midwinter.season, midwinter.summerness);
      if (weather.tempMax <= 0) expect(["rain", "storm"]).not.toContain(weather.condition);
    }
  });

  it("only ever produces a known condition", () => {
    for (let day = 1; day <= 30; day++) {
      const key = `2025-09-${String(day).padStart(2, "0")}`;
      const { condition } = generateDailyWeather(key, "autumn", 0.5);
      expect(WEATHER_CONDITIONS).toContain(condition);
    }
  });

  it("produces snow in winter but not in summer", () => {
    const winterConditions = new Set(
      Array.from({ length: 60 }, (_, i) => generateDailyWeather(`w${i}`, "winter", 0).condition),
    );
    const summerConditions = new Set(
      Array.from({ length: 60 }, (_, i) => generateDailyWeather(`s${i}`, "summer", 1).condition),
    );
    expect(winterConditions.has("snow")).toBe(true);
    expect(summerConditions.has("snow")).toBe(false);
  });
});

describe("temperatureAt", () => {
  const day = { condition: "clear" as const, tempMin: -8, tempMax: 4 };

  it("hits the minimum before dawn and the maximum mid-afternoon", () => {
    expect(temperatureAt(5, 0, day)).toBe(-8);
    expect(temperatureAt(17, 0, day)).toBe(4);
  });

  it("stays between the two extremes at every hour", () => {
    for (let hour = 0; hour < 24; hour++) {
      const temp = temperatureAt(hour, 30, day);
      expect(temp).toBeGreaterThanOrEqual(day.tempMin);
      expect(temp).toBeLessThanOrEqual(day.tempMax);
    }
  });

  it("warms through the morning and cools through the night", () => {
    expect(temperatureAt(11, 0, day)).toBeGreaterThan(temperatureAt(7, 0, day));
    expect(temperatureAt(23, 0, day)).toBeLessThan(temperatureAt(19, 0, day));
  });
});

describe("isWeatherCondition", () => {
  it("accepts known conditions and rejects anything else", () => {
    expect(isWeatherCondition("storm")).toBe(true);
    expect(isWeatherCondition("hail")).toBe(false);
    expect(isWeatherCondition(null)).toBe(false);
  });
});
