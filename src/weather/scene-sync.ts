import { MODULE_ID } from "../constants.js";
import { getWeatherEffectMap, isSceneWeatherSyncEnabled } from "../settings.js";
import { WEATHER_CONDITIONS, type WeatherCondition } from "./generator.js";

/**
 * Drives Foundry's scene weather from the generated condition.
 *
 * `CONFIG.weatherEffects` is a registry other modules also write into — FXMaster's ambiences show
 * up alongside the core ones — so the mapping is discovered from whatever is registered at runtime
 * rather than hardcoded against a list of core keys.
 */

const FLAG_LAST_WRITTEN = "lastWeatherKey";
const FLAG_OPT_OUT = "weatherSyncDisabled";

/** Conditions core has no ambience for. Left unmapped rather than approximated with something wrong. */
const NO_NATURAL_EFFECT: readonly WeatherCondition[] = ["clear"];

function availableEffectKeys(): string[] {
  return Object.keys(CONFIG.weatherEffects ?? {});
}

/**
 * Picks the best registered effect for a set of name fragments, preferring an exact key, then a
 * core key, then anything at all. The core preference matters because a world with FXMaster
 * installed has two plausible candidates for most conditions.
 */
function bestEffectKey(candidates: readonly string[]): string {
  const keys = availableEffectKeys();
  const isCore = (key: string): boolean => !key.includes(".") && !key.toLowerCase().includes("fxmaster");

  for (const candidate of candidates) {
    const exact = keys.find((k) => k.toLowerCase() === candidate);
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    const core = keys.find((k) => isCore(k) && k.toLowerCase().includes(candidate));
    if (core) return core;
  }
  for (const candidate of candidates) {
    const any = keys.find((k) => k.toLowerCase().includes(candidate));
    if (any) return any;
  }
  return "";
}

/** Name fragments to look for, most specific first. */
const EFFECT_CANDIDATES: Readonly<Record<WeatherCondition, readonly string[]>> = {
  clear: [],
  cloudy: ["cloud"],
  overcast: ["cloud"],
  fog: ["fog", "mist"],
  rain: ["rain"],
  storm: ["rainstorm", "thunder", "storm"],
  snow: ["snow"],
  windy: ["leaves"],
};

export function defaultWeatherEffectMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const condition of WEATHER_CONDITIONS) {
    map[condition] = NO_NATURAL_EFFECT.includes(condition)
      ? ""
      : bestEffectKey(EFFECT_CANDIDATES[condition]);
  }
  return map;
}

export function effectKeyFor(condition: WeatherCondition): string {
  const configured = getWeatherEffectMap();
  const value = configured[condition];
  return typeof value === "string" ? value : (defaultWeatherEffectMap()[condition] ?? "");
}

function targetScene(): FoundryScene | null {
  const scenes = game.scenes;
  return scenes?.viewed ?? scenes?.current ?? scenes?.active ?? null;
}

function isActiveGM(): boolean {
  return game.user.isGM && game.users.activeGM?.id === game.user.id;
}

/**
 * Applies the condition to the current scene, if the GM has asked for that and the scene has not
 * been dressed by hand.
 *
 * Silently doing nothing is the correct outcome for most of these branches — this writes to a
 * persistent document, so every reason to hold back wins over the reason to write.
 */
export async function applySceneWeather(condition: WeatherCondition): Promise<void> {
  if (!isSceneWeatherSyncEnabled() || !isActiveGM()) return;

  const scene = targetScene();
  if (!scene || scene.getFlag(MODULE_ID, FLAG_OPT_OUT) === true) return;

  const lastWritten = scene.getFlag(MODULE_ID, FLAG_LAST_WRITTEN);
  const currentWeather = scene.weather ?? "";

  // Anything we did not put there was put there deliberately by a person. Leave it.
  if (currentWeather !== "" && currentWeather !== lastWritten) return;

  const key = effectKeyFor(condition);
  if (key === currentWeather) return;

  try {
    await scene.update({ weather: key });
    await scene.setFlag(MODULE_ID, FLAG_LAST_WRITTEN, key);
  } catch (error) {
    console.error("pf2e-calendar-bar | could not apply scene weather:", error);
  }
}

export function isSceneOptedOut(scene: FoundryScene): boolean {
  return scene.getFlag(MODULE_ID, FLAG_OPT_OUT) === true;
}

export const setSceneOptOut = (scene: FoundryScene, optedOut: boolean): Promise<FoundryScene> =>
  scene.setFlag(MODULE_ID, FLAG_OPT_OUT, optedOut);
