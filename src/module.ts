import { getCalendarBar, refreshCalendarBar } from "./apps/calendar-bar.js";
import { injectSceneWeatherOptOut } from "./apps/scene-config.js";
import { MODULE_ID, REQUIRED_SYSTEM } from "./constants.js";
import { getCalendarFile, getWeatherEffectMap, isWeatherEnabled, registerSettings, setWeatherEffectMap } from "./settings.js";
import { labelsFromSystem, loadCalendarLabels, setCalendarLabels } from "./time/calendar.js";
import { dateKeyOf, getWorldDate, verifyAgainstSystemClock } from "./time/pf2e-clock.js";
import { refreshTicker, stopTicker } from "./time/ticker.js";
import { applySceneWeather, defaultWeatherEffectMap } from "./weather/scene-sync.js";
import { weatherFor } from "./weather/state.js";

/** Tracks day rollovers so scene weather is only re-applied when the weather can actually differ. */
let lastDateKey: string | null = null;

function isActiveGM(): boolean {
  return game.user.isGM && game.users.activeGM?.id === game.user.id;
}

async function syncSceneWeatherIfDayChanged(): Promise<void> {
  if (!isWeatherEnabled()) return;
  const date = getWorldDate();
  const key = dateKeyOf(date);
  if (key === lastDateKey) return;

  lastDateKey = key;
  await applySceneWeather(weatherFor(date).condition);
}

async function resolveCalendarLabels(): Promise<void> {
  const fromSystem = labelsFromSystem();
  if (fromSystem) setCalendarLabels(fromSystem);

  const custom = getCalendarFile();
  if (!custom) return;

  const loaded = await loadCalendarLabels(custom);
  if (loaded) setCalendarLabels(loaded);
}

/**
 * Seeds the condition-to-effect mapping from whatever ambiences are registered in this world.
 * Written once, by one client, so a GM editing it later is not overwritten on the next load.
 */
async function seedWeatherEffectMap(): Promise<void> {
  if (!isActiveGM()) return;
  if (Object.keys(getWeatherEffectMap()).length > 0) return;
  await setWeatherEffectMap(defaultWeatherEffectMap());
}

Hooks.once("init", () => {
  registerSettings(refreshCalendarBar, () => {
    refreshTicker();
    refreshCalendarBar();
  });
});

Hooks.once("ready", () => {
  void (async (): Promise<void> => {
    if (game.system.id !== REQUIRED_SYSTEM) {
      // Every date we display comes from the PF2e World Clock, so on another system there is
      // nothing to show. Say so once rather than failing obscurely later.
      ui.notifications?.warn(
        `${MODULE_ID}: requires the ${REQUIRED_SYSTEM} system, found "${game.system.id}". The calendar bar is disabled.`,
      );
      return;
    }

    await resolveCalendarLabels();

    const agreement = verifyAgainstSystemClock();
    console.log(`${MODULE_ID} | ${agreement.detail}`);

    await seedWeatherEffectMap();

    lastDateKey = dateKeyOf(getWorldDate());
    await getCalendarBar().render(true);
    refreshTicker();
    await applySceneWeather(weatherFor(getWorldDate()).condition);
  })();
});

Hooks.on("updateWorldTime", () => {
  refreshCalendarBar();
  void syncSceneWeatherIfDayChanged();
});

// The ticker's conditions live outside our own settings, so every event that can change them has
// to route back through the same refresh.
Hooks.on("pauseGame", () => {
  refreshTicker();
  refreshCalendarBar();
});
Hooks.on("userConnected", () => {
  refreshTicker();
  refreshCalendarBar();
});
for (const hook of ["createCombat", "deleteCombat", "updateCombat"]) {
  Hooks.on(hook, () => {
    refreshTicker();
    refreshCalendarBar();
  });
}

Hooks.on("renderSceneConfig", (app: unknown, rendered: unknown) => {
  injectSceneWeatherOptOut(app, rendered);
});

Hooks.on("canvasReady", () => {
  void (async (): Promise<void> => {
    if (!isWeatherEnabled()) return;
    await applySceneWeather(weatherFor(getWorldDate()).condition);
  })();
});

// A client that is closing should not leave an interval advancing world time.
window.addEventListener("beforeunload", () => stopTicker());
