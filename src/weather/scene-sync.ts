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

/**
 * The scene actually on screen. `canvas.scene` is unambiguous about that; the Scenes collection
 * has carried differently-named accessors across versions, so it is only a fallback.
 */
export function targetScene(): FoundryScene | null {
  return canvas?.scene ?? game.scenes?.current ?? game.scenes?.active ?? null;
}

function isActiveGM(): boolean {
  return game.user.isGM && game.users.activeGM?.id === game.user.id;
}

/** Why a sync attempt did nothing, so an inert feature never looks the same as a working one. */
export type SyncOutcome =
  | { applied: true; key: string; scene: string }
  | { applied: false; reason: string; scene?: string };

/**
 * Applies the condition to the scene on screen, if the GM has asked for that and the scene has not
 * been dressed by hand.
 *
 * Every refusal is reported rather than swallowed. This writes to a persistent document, so the
 * guards are deliberately generous — which makes it all the more important to be able to tell a
 * guard from a bug.
 */
export async function applySceneWeather(condition: WeatherCondition): Promise<SyncOutcome> {
  if (!isSceneWeatherSyncEnabled()) return report({ applied: false, reason: "scene weather sync is switched off in module settings" });
  if (!isActiveGM()) return report({ applied: false, reason: "this client is not the active GM" });

  const scene = targetScene();
  if (!scene) return report({ applied: false, reason: "no scene is currently in view" });

  if (scene.getFlag(MODULE_ID, FLAG_OPT_OUT) === true) {
    return report({ applied: false, reason: "the scene is set to ignore calendar weather", scene: scene.name });
  }

  const lastWritten = scene.getFlag(MODULE_ID, FLAG_LAST_WRITTEN);
  const currentWeather = scene.weather ?? "";

  // Anything we did not put there was put there deliberately by a person. Leave it.
  if (currentWeather !== "" && currentWeather !== lastWritten) {
    return report({
      applied: false,
      reason: `the scene's weather ("${currentWeather}") was set by hand, not by us`,
      scene: scene.name,
    });
  }

  const key = effectKeyFor(condition);
  if (key === currentWeather) {
    return report({ applied: false, reason: `already showing the effect for "${condition}"`, scene: scene.name });
  }

  try {
    await scene.update({ weather: key });
    await scene.setFlag(MODULE_ID, FLAG_LAST_WRITTEN, key);
    return report({ applied: true, key: key === "" ? "(none)" : key, scene: scene.name });
  } catch (error) {
    console.error(`${MODULE_ID} | could not apply scene weather:`, error);
    return report({ applied: false, reason: "the scene update failed", scene: scene.name });
  }
}

function report(outcome: SyncOutcome): SyncOutcome {
  const where = outcome.scene ? ` on "${outcome.scene}"` : "";
  if (outcome.applied) console.log(`${MODULE_ID} | weather effect set to ${outcome.key}${where}`);
  else console.log(`${MODULE_ID} | weather effect not applied${where}: ${outcome.reason}`);
  return outcome;
}

export function isSceneOptedOut(scene: FoundryScene): boolean {
  return scene.getFlag(MODULE_ID, FLAG_OPT_OUT) === true;
}

export const setSceneOptOut = (scene: FoundryScene, optedOut: boolean): Promise<FoundryScene> =>
  scene.setFlag(MODULE_ID, FLAG_OPT_OUT, optedOut);
