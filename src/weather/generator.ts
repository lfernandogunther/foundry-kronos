import type { Season } from "../time/season.js";

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "overcast"
  | "fog"
  | "rain"
  | "storm"
  | "snow"
  | "windy";

export const WEATHER_CONDITIONS: readonly WeatherCondition[] = [
  "clear",
  "cloudy",
  "overcast",
  "fog",
  "rain",
  "storm",
  "snow",
  "windy",
] as const;

export function isWeatherCondition(value: unknown): value is WeatherCondition {
  return typeof value === "string" && (WEATHER_CONDITIONS as readonly string[]).includes(value);
}

export interface DailyWeather {
  condition: WeatherCondition;
  /** Coldest point of the day, °C. */
  tempMin: number;
  /** Warmest point of the day, °C. */
  tempMax: number;
}

/**
 * Seasonal temperature envelope in °C. The default is a central-European continental climate,
 * which is what the seasonal daylight curve is set up for.
 */
export interface ClimateProfile {
  winterLow: number;
  winterHigh: number;
  summerLow: number;
  summerHigh: number;
  /** How far a single day may stray from the seasonal average, °C. */
  dailyVariance: number;
}

export const TEMPERATE_EUROPE: ClimateProfile = {
  winterLow: -6,
  winterHigh: 3,
  summerLow: 13,
  summerHigh: 26,
  dailyVariance: 6,
};

type ConditionWeights = Partial<Record<WeatherCondition, number>>;

const SEASON_WEIGHTS: Readonly<Record<Season, ConditionWeights>> = {
  winter: { clear: 18, cloudy: 22, overcast: 24, fog: 10, rain: 8, storm: 2, snow: 12, windy: 4 },
  spring: { clear: 26, cloudy: 24, overcast: 16, fog: 6, rain: 18, storm: 4, snow: 1, windy: 5 },
  summer: { clear: 44, cloudy: 20, overcast: 10, fog: 2, rain: 12, storm: 8, snow: 0, windy: 4 },
  autumn: { clear: 22, cloudy: 24, overcast: 20, fog: 12, rain: 14, storm: 4, snow: 1, windy: 3 },
};

/**
 * Deterministic string hash, so the same in-world day always produces the same weather.
 *
 * Weather must not change when a client re-renders or a player reloads, and it must be identical
 * on every client without anyone broadcasting it — seeding from the date key gives both.
 */
function hashSeed(text: string): number {
  let h = 1_779_033_703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3_432_918_353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

/** Small, fast, well-distributed PRNG. Quality beyond this is wasted on weather. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pickWeighted(weights: ConditionWeights, roll: number): WeatherCondition {
  const entries = WEATHER_CONDITIONS.map((c) => [c, weights[c] ?? 0] as const).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let cursor = roll * total;
  for (const [condition, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return condition;
  }
  return entries[entries.length - 1]?.[0] ?? "clear";
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * Keeps the condition and the temperature from contradicting each other. Snow above freezing and
 * a hard frost with rain both read as broken, however plausible each half was on its own.
 */
function reconcile(condition: WeatherCondition, tempMax: number): WeatherCondition {
  if (condition === "snow" && tempMax > 2) return "rain";
  if ((condition === "rain" || condition === "storm") && tempMax <= 0) return "snow";
  return condition;
}

/**
 * @param dateKey stable identifier for the in-world day
 * @param season  drives which conditions are likely
 * @param summerness 0 at midwinter, 1 at midsummer; drives the temperature envelope
 */
export function generateDailyWeather(
  dateKey: string,
  season: Season,
  summerness: number,
  climate: ClimateProfile = TEMPERATE_EUROPE,
): DailyWeather {
  const random = mulberry32(hashSeed(dateKey));

  const conditionRoll = random();
  const varianceRoll = random();

  const seasonalLow = lerp(climate.winterLow, climate.summerLow, summerness);
  const seasonalHigh = lerp(climate.winterHigh, climate.summerHigh, summerness);
  const drift = (varianceRoll * 2 - 1) * climate.dailyVariance;

  const tempMin = Math.round(seasonalLow + drift);
  const tempMax = Math.round(Math.max(seasonalHigh + drift, tempMin + 1));

  const condition = reconcile(pickWeighted(SEASON_WEIGHTS[season], conditionRoll), tempMax);
  return { condition, tempMin, tempMax };
}

/**
 * Temperature at a given hour, coldest before dawn and warmest mid-afternoon.
 *
 * A plain cosine between the day's two extremes: enough for the reading on the bar to drift the
 * way a day actually feels, without pretending to model anything.
 */
export function temperatureAt(hour: number, minute: number, weather: DailyWeather): number {
  const COLDEST_HOUR = 5;
  const hours = hour + minute / 60;
  const phase = ((hours - COLDEST_HOUR) / 24) * 2 * Math.PI;
  const warmth = (1 - Math.cos(phase)) / 2;
  return Math.round(lerp(weather.tempMin, weather.tempMax, warmth));
}
