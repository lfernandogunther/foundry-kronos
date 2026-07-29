import { MODULE_ID } from "../constants.js";
import type { WorldDate } from "../time/pf2e-clock.js";
import { isWeatherCondition, WEATHER_CONDITIONS } from "../weather/generator.js";
import { clearOverride, isOverridden, overrideWeather, weatherFor } from "../weather/state.js";
import { applySceneWeather, type SyncOutcome } from "../weather/scene-sync.js";

const t = (key: string): string => game.i18n?.localize(key) ?? key;

/**
 * Lets the GM replace the generated weather for the current day.
 *
 * Overrides are stored per day and are what stops the value drifting back on the next render —
 * ordinary days are regenerated from the date, so without a stored override there would be
 * nothing to hold a manual choice in place.
 */
/**
 * Tells the GM when a weather change did not reach the canvas.
 *
 * Setting the weather and seeing nothing happen is what made this feature look broken; a refusal
 * the user cannot see is indistinguishable from a bug.
 */
function announce(outcome: SyncOutcome): void {
  if (outcome.applied) return;
  ui.notifications?.info(game.i18n?.format("KRONOS.Override.NotApplied", { reason: outcome.reason }) ?? outcome.reason);
}

export async function openWeatherOverride(date: WorldDate): Promise<void> {
  if (!game.user.isGM) return;

  const current = weatherFor(date);
  const options = WEATHER_CONDITIONS.map(
    (condition) =>
      `<option value="${condition}" ${condition === current.condition ? "selected" : ""}>${t(`KRONOS.Weather.${condition}`)}</option>`,
  ).join("");

  const content = `
    <form class="kronos-override">
      <div class="form-group">
        <label for="kronos-condition">${t("KRONOS.Override.Condition")}</label>
        <select id="kronos-condition" name="condition">${options}</select>
      </div>
      <div class="form-group">
        <label for="kronos-temp-min">${t("KRONOS.Override.TempMin")}</label>
        <input id="kronos-temp-min" type="number" name="tempMin" value="${current.tempMin}" />
      </div>
      <div class="form-group">
        <label for="kronos-temp-max">${t("KRONOS.Override.TempMax")}</label>
        <input id="kronos-temp-max" type="number" name="tempMax" value="${current.tempMax}" />
      </div>
      <p class="notes">${t("KRONOS.Override.Hint")}</p>
    </form>`;

  const dialog = foundry.applications.api.DialogV2;
  if (!dialog?.wait) {
    console.error(`${MODULE_ID} | DialogV2 is unavailable; cannot open the weather override`);
    return;
  }

  const buttons: Record<string, unknown>[] = [
    {
      action: "save",
      icon: "fa-solid fa-check",
      label: t("KRONOS.Override.Save"),
      default: true,
      callback: (_event: unknown, button: { form?: HTMLFormElement }): void => {
        const form = button.form;
        if (!form) return;
        const data = new FormData(form);
        const condition = data.get("condition");
        if (!isWeatherCondition(condition)) return;

        const tempMin = Number(data.get("tempMin"));
        const tempMax = Number(data.get("tempMax"));
        if (!Number.isFinite(tempMin) || !Number.isFinite(tempMax)) return;

        // A maximum below the minimum would make the hourly curve run backwards.
        const low = Math.min(tempMin, tempMax);
        const high = Math.max(tempMin, tempMax);

        void overrideWeather(date, { condition, tempMin: low, tempMax: high })
          .then(() => applySceneWeather(condition))
          .then(announce);
      },
    },
  ];

  if (isOverridden(date)) {
    buttons.push({
      action: "clear",
      icon: "fa-solid fa-rotate-left",
      label: t("KRONOS.Override.Clear"),
      callback: (): void => {
        void clearOverride()
          .then(() => applySceneWeather(weatherFor(date).condition))
          .then(announce);
      },
    });
  }

  // `wait` rather than `prompt`: prompt injects a confirmation button of its own, which submits
  // the dialog without running any of our callbacks — so it silently discards the form.
  await dialog.wait({
    window: { title: t("KRONOS.Override.Title") },
    content,
    buttons,
    rejectClose: false,
  });
}
