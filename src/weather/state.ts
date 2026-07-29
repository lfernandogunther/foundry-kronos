import { getClimate, getWeatherOverride, setWeatherOverride } from "../settings.js";
import { dateKeyOf, type WorldDate } from "../time/clock.js";
import { summerness } from "../time/season.js";
import { type DailyWeather, generateDailyWeather } from "./generator.js";

/**
 * Weather for the current in-world day.
 *
 * Nothing is written on a day rollover. Generation is deterministic from the date key, so every
 * client derives the identical result independently — no broadcast, no write, and no race between
 * two connected GMs. Only a GM's manual override is persisted, because that is the one piece of
 * information the others cannot derive.
 */
export function weatherFor(date: WorldDate): DailyWeather {
  const key = dateKeyOf(date);

  const override = getWeatherOverride();
  if (override && override.dateKey === key) {
    return { condition: override.condition, tempMin: override.tempMin, tempMax: override.tempMax };
  }

  return generateDailyWeather(
    key,
    date.season,
    summerness(date.dayOfYear, date.daysInYear),
    getClimate(),
  );
}

export function isOverridden(date: WorldDate): boolean {
  const override = getWeatherOverride();
  return override !== null && override.dateKey === dateKeyOf(date);
}

export const overrideWeather = (date: WorldDate, weather: DailyWeather): Promise<unknown> =>
  setWeatherOverride({ dateKey: dateKeyOf(date), ...weather });

/** Drops the override so the day falls back to its generated weather. */
export const clearOverride = (): Promise<unknown> => setWeatherOverride(null);
