import { MODULE_ID } from "../constants.js";
import { isSceneOptedOut, setSceneOptOut } from "../weather/scene-sync.js";

const t = (key: string): string => game.i18n?.localize(key) ?? key;

/** The hook hands over an HTMLElement in current versions and a jQuery object in older ones. */
function toElement(candidate: unknown): HTMLElement | null {
  if (candidate instanceof HTMLElement) return candidate;
  const jquery = candidate as { 0?: unknown } | null;
  return jquery?.[0] instanceof HTMLElement ? jquery[0] : null;
}

/**
 * Adds an opt-out checkbox beside the scene's own weather field.
 *
 * Indoor and underground scenes must be able to sit out the sync, and the scene's weather
 * configuration is where a GM would look for that.
 */
export function injectSceneWeatherOptOut(app: unknown, rendered: unknown): void {
  const root = toElement(rendered);
  const scene = (app as { document?: FoundryScene } | null)?.document;
  if (!root || !scene) return;

  if (root.querySelector(`[name="flags.${MODULE_ID}.weatherSyncDisabled"]`)) return;

  const weatherField = root.querySelector<HTMLElement>('[name="weather"]');
  const anchor = weatherField?.closest(".form-group") ?? null;
  if (!anchor) return;

  const group = document.createElement("div");
  group.className = "form-group";

  const label = document.createElement("label");
  label.textContent = t("PF2ECALENDARBAR.Scene.OptOut.Name");

  const fields = document.createElement("div");
  fields.className = "form-fields";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = `flags.${MODULE_ID}.weatherSyncDisabled`;
  checkbox.checked = isSceneOptedOut(scene);
  // Written immediately rather than on form submit: the scene config may be closed without
  // saving, and a half-applied opt-out is worse than none.
  checkbox.addEventListener("change", () => void setSceneOptOut(scene, checkbox.checked));

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = t("PF2ECALENDARBAR.Scene.OptOut.Hint");

  fields.append(checkbox);
  group.append(label, fields, hint);
  anchor.after(group);
}
