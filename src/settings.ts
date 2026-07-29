import { WeatherMappingApp } from "./apps/weather-mapping.js";
import { MODULE_ID } from "./constants.js";
import type { StepUnit } from "./time/units.js";
import { isStepUnit } from "./time/units.js";
import type { ClimateProfile, WeatherCondition } from "./weather/generator.js";
import { isWeatherCondition, TEMPERATE_EUROPE } from "./weather/generator.js";

export const SETTINGS = {
  latitude: "latitude",
  stepMultiplier: "stepMultiplier",
  weatherEnabled: "weatherEnabled",
  climate: "climate",
  weatherOverride: "weatherOverride",
  clockRunning: "clockRunning",
  clockRatio: "clockRatio",
  clockTickSeconds: "clockTickSeconds",
  pauseOnCombat: "pauseOnCombat",
  sceneWeatherSync: "sceneWeatherSync",
  weatherEffectMap: "weatherEffectMap",
  calendarFile: "calendarFile",
  barPosition: "barPosition",
  stepUnit: "stepUnit",
} as const;

/** Persisted only when a GM overrides the generated weather; ordinary days are derived, not stored. */
export interface WeatherOverride {
  dateKey: string;
  condition: WeatherCondition;
  tempMin: number;
  tempMax: number;
}

export interface BarPosition {
  left: number;
  top: number;
}

const t = (key: string): string => game.i18n?.localize(key) ?? key;

export function registerSettings(onBarRefresh: () => void, onClockRefresh: () => void): void {
  const register = (key: string, data: Parameters<typeof game.settings.register>[2]): void =>
    game.settings.register(MODULE_ID, key, data);

  register(SETTINGS.latitude, {
    name: t("KRONOS.Settings.Latitude.Name"),
    hint: t("KRONOS.Settings.Latitude.Hint"),
    scope: "world",
    config: true,
    type: Number,
    default: 48,
    range: { min: -66, max: 66, step: 1 },
    onChange: onBarRefresh,
  });

  register(SETTINGS.stepMultiplier, {
    name: t("KRONOS.Settings.StepMultiplier.Name"),
    hint: t("KRONOS.Settings.StepMultiplier.Hint"),
    scope: "world",
    config: true,
    type: Number,
    default: 10,
    range: { min: 2, max: 60, step: 1 },
    onChange: onBarRefresh,
  });

  register(SETTINGS.weatherEnabled, {
    name: t("KRONOS.Settings.WeatherEnabled.Name"),
    hint: t("KRONOS.Settings.WeatherEnabled.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: onBarRefresh,
  });

  register(SETTINGS.clockRatio, {
    name: t("KRONOS.Settings.ClockRatio.Name"),
    hint: t("KRONOS.Settings.ClockRatio.Hint"),
    scope: "world",
    config: true,
    type: Number,
    default: 1,
    range: { min: 1, max: 600, step: 1 },
    onChange: onClockRefresh,
  });

  register(SETTINGS.clockTickSeconds, {
    name: t("KRONOS.Settings.ClockTick.Name"),
    hint: t("KRONOS.Settings.ClockTick.Hint"),
    scope: "world",
    config: true,
    type: Number,
    default: 10,
    range: { min: 1, max: 60, step: 1 },
    onChange: onClockRefresh,
  });

  register(SETTINGS.pauseOnCombat, {
    name: t("KRONOS.Settings.PauseOnCombat.Name"),
    hint: t("KRONOS.Settings.PauseOnCombat.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: onClockRefresh,
  });

  register(SETTINGS.sceneWeatherSync, {
    name: t("KRONOS.Settings.SceneWeatherSync.Name"),
    hint: t("KRONOS.Settings.SceneWeatherSync.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    // On by default. It writes to Scene documents, which argued for opt-in, but the no-stomp guard
    // and the per-scene opt-out already cover that — and shipping it off made a working feature
    // look broken.
    default: true,
    onChange: onBarRefresh,
  });

  register(SETTINGS.calendarFile, {
    name: t("KRONOS.Settings.CalendarFile.Name"),
    hint: t("KRONOS.Settings.CalendarFile.Hint"),
    scope: "world",
    config: true,
    type: String,
    default: "",
    requiresReload: true,
  });

  game.settings.registerMenu(MODULE_ID, "weatherMappingMenu", {
    name: t("KRONOS.Mapping.Name"),
    label: t("KRONOS.Mapping.Label"),
    hint: t("KRONOS.Mapping.Hint"),
    icon: "fa-solid fa-cloud-sun-rain",
    type: WeatherMappingApp,
    restricted: true,
  });

  // Derived or machine-managed state: no place in the settings form.
  register(SETTINGS.clockRunning, { scope: "world", config: false, type: Boolean, default: false, onChange: onClockRefresh });
  register(SETTINGS.weatherOverride, { scope: "world", config: false, type: Object, default: null, onChange: onBarRefresh });
  register(SETTINGS.climate, { scope: "world", config: false, type: Object, default: TEMPERATE_EUROPE });
  register(SETTINGS.weatherEffectMap, { scope: "world", config: false, type: Object, default: {} });
  register(SETTINGS.barPosition, { scope: "client", config: false, type: Object, default: null });
  register(SETTINGS.stepUnit, { scope: "client", config: false, type: String, default: "minute" });
}

function read(key: string): unknown {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return undefined;
  }
}

const readNumber = (key: string, fallback: number): number => {
  const value = read(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const readBoolean = (key: string, fallback: boolean): boolean => {
  const value = read(key);
  return typeof value === "boolean" ? value : fallback;
};

export const getLatitude = (): number => readNumber(SETTINGS.latitude, 48);
export const getStepMultiplier = (): number => readNumber(SETTINGS.stepMultiplier, 10);
export const isWeatherEnabled = (): boolean => readBoolean(SETTINGS.weatherEnabled, true);
export const getClockRatio = (): number => readNumber(SETTINGS.clockRatio, 1);
export const getClockTickSeconds = (): number => readNumber(SETTINGS.clockTickSeconds, 10);
export const shouldPauseOnCombat = (): boolean => readBoolean(SETTINGS.pauseOnCombat, true);
export const isClockRunning = (): boolean => readBoolean(SETTINGS.clockRunning, false);
export const isSceneWeatherSyncEnabled = (): boolean => readBoolean(SETTINGS.sceneWeatherSync, true);
export const getCalendarFile = (): string => (typeof read(SETTINGS.calendarFile) === "string" ? (read(SETTINGS.calendarFile) as string) : "");

export function getClimate(): ClimateProfile {
  const value = read(SETTINGS.climate);
  if (typeof value !== "object" || value === null) return TEMPERATE_EUROPE;
  // Merged rather than replaced so a partially-filled object cannot produce NaN temperatures.
  return { ...TEMPERATE_EUROPE, ...(value as Partial<ClimateProfile>) };
}

export function getStepUnit(): StepUnit {
  const value = read(SETTINGS.stepUnit);
  return isStepUnit(value) ? value : "minute";
}

export const setStepUnit = (unit: StepUnit): Promise<unknown> =>
  game.settings.set(MODULE_ID, SETTINGS.stepUnit, unit);

export function getWeatherOverride(): WeatherOverride | null {
  const value = read(SETTINGS.weatherOverride);
  if (typeof value !== "object" || value === null) return null;
  const o = value as Partial<WeatherOverride>;
  if (typeof o.dateKey !== "string" || !isWeatherCondition(o.condition)) return null;
  if (typeof o.tempMin !== "number" || typeof o.tempMax !== "number") return null;
  return { dateKey: o.dateKey, condition: o.condition, tempMin: o.tempMin, tempMax: o.tempMax };
}

export const setWeatherOverride = (override: WeatherOverride | null): Promise<unknown> =>
  game.settings.set(MODULE_ID, SETTINGS.weatherOverride, override);

export const setClockRunning = (running: boolean): Promise<unknown> =>
  game.settings.set(MODULE_ID, SETTINGS.clockRunning, running);

export function getWeatherEffectMap(): Record<string, string> {
  const value = read(SETTINGS.weatherEffectMap);
  return typeof value === "object" && value !== null ? (value as Record<string, string>) : {};
}

export const setWeatherEffectMap = (map: Record<string, string>): Promise<unknown> =>
  game.settings.set(MODULE_ID, SETTINGS.weatherEffectMap, map);

export function getBarPosition(): BarPosition | null {
  const value = read(SETTINGS.barPosition);
  if (typeof value !== "object" || value === null) return null;
  const p = value as Partial<BarPosition>;
  return typeof p.left === "number" && typeof p.top === "number" ? { left: p.left, top: p.top } : null;
}

export const setBarPosition = (position: BarPosition): Promise<unknown> =>
  game.settings.set(MODULE_ID, SETTINGS.barPosition, position);
