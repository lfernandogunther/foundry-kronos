import { getCalendarBar, refreshCalendarBar } from "./apps/calendar-bar.js";
import { injectSceneFields } from "./apps/scene-config.js";
import { warnAboutDarknessConflicts } from "./scene/conflicts.js";
import { applySceneDarkness, isDarknessControlled } from "./scene/darkness.js";
import { MODULE_ID, REQUIRED_SYSTEM } from "./constants.js";
import { getCalendarFile, getCalendarId, getWeatherEffectMap, isWeatherEnabled, registerSettings, setWeatherEffectMap } from "./settings.js";
import {
  bundledCalendar,
  calendarFromSystem,
  DEFAULT_CALENDAR_ID,
  getCalendar,
  hasOwnMonths,
  loadCalendar,
  setCalendar,
} from "./time/calendar.js";
import { getWorldDate } from "./time/clock.js";
import { verifyAgainstSystemClock } from "./time/pf2e-clock.js";
import { refreshTicker, stopTicker } from "./time/ticker.js";
import { applySceneWeather, defaultWeatherEffectMap, targetScene } from "./weather/scene-sync.js";
import { weatherFor } from "./weather/state.js";

/** Tracks day rollovers so scene weather is only re-applied when the weather can actually differ. */
let lastDateKey: string | null = null;

function isActiveGM(): boolean {
  return game.user.isGM && game.users.activeGM?.id === game.user.id;
}

async function syncSceneWeatherIfDayChanged(): Promise<void> {
  if (!isWeatherEnabled()) return;
  const date = getWorldDate();
  const key = date.dayKey;
  if (key === lastDateKey) return;

  lastDateKey = key;
  await applySceneWeather(weatherFor(date).condition);
}

/**
 * Settles which calendar is in force, most general choice first: the bundled one the GM picked, then
 * the live system names where those are what was picked, then a file if one is configured.
 */
async function resolveCalendar(): Promise<void> {
  const id = getCalendarId();
  setCalendar(bundledCalendar(id));

  // The system's names describe its own Gregorian clock. Letting them through while a calendar of
  // its own is selected would rename Tarlan's months to Golarion's.
  if (id === DEFAULT_CALENDAR_ID) {
    const fromSystem = calendarFromSystem();
    if (fromSystem) setCalendar(fromSystem);
  }

  const custom = getCalendarFile();
  if (!custom) return;

  const loaded = await loadCalendar(custom);
  if (loaded) setCalendar(loaded);
}

/**
 * Says which clock the bar is keeping, and how it relates to the system's.
 *
 * Agreement with the PF2e World Clock is a guarantee worth checking while it holds, and a calendar
 * with months of its own gives it up deliberately. Both cases need saying — the second one loudly
 * enough that a GM comparing two different dates on screen knows why before asking.
 */
function reportClockAgreement(): void {
  const calendar = getCalendar();

  if (!hasOwnMonths(calendar)) {
    console.log(`${MODULE_ID} | ${verifyAgainstSystemClock().detail}`);
    return;
  }

  const date = getWorldDate();
  console.log(
    `${MODULE_ID} | reckoning in "${calendar.name}": ${date.day} ${date.monthName} ${date.year} ${date.era}, ${date.weekdayName}. ` +
      `Its months are its own, so the PF2e World Clock shows a different date for this same moment. ` +
      `That is expected and the two cannot be reconciled; run one of them as the calendar of record.`,
  );
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

    await resolveCalendar();

    reportClockAgreement();

    await seedWeatherEffectMap();

    lastDateKey = getWorldDate().dayKey;
    await getCalendarBar().render(true);
    refreshTicker();
    await applySceneWeather(weatherFor(getWorldDate()).condition);
  })();
});

Hooks.on("updateWorldTime", () => {
  refreshCalendarBar();
  void syncSceneWeatherIfDayChanged();
  // Every time change, not only day rollovers: darkness moves through dawn and dusk. The write
  // itself is skipped unless the level has actually shifted.
  void applySceneDarkness();
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
  injectSceneFields(app, rendered);
});

Hooks.on("canvasReady", () => {
  void (async (): Promise<void> => {
    const scene = targetScene();
    if (scene && isDarknessControlled(scene)) warnAboutDarknessConflicts(scene);

    // A scene entered at night should already be dark, not darken a tick later.
    await applySceneDarkness();

    if (!isWeatherEnabled()) return;
    await applySceneWeather(weatherFor(getWorldDate()).condition);
  })();
});

// A client that is closing should not leave an interval advancing world time.
window.addEventListener("beforeunload", () => stopTicker());
