import { MODULE_ID } from "../constants.js";
import { isDarknessControlled, setDarknessControlled } from "../scene/darkness.js";
import { isSceneOptedOut, setSceneOptOut } from "../weather/scene-sync.js";

const t = (key: string): string => game.i18n?.localize(key) ?? key;

/** The hook hands over an HTMLElement in current versions and a jQuery object in older ones. */
function toElement(candidate: unknown): HTMLElement | null {
  if (candidate instanceof HTMLElement) return candidate;
  const jquery = candidate as { 0?: unknown } | null;
  return jquery?.[0] instanceof HTMLElement ? jquery[0] : null;
}

interface CheckboxField {
  flag: string;
  labelKey: string;
  hintKey: string;
  checked: (scene: FoundryScene) => boolean;
  apply: (scene: FoundryScene, value: boolean) => Promise<unknown>;
  /** Selector for the core field this one should sit beneath. */
  anchorSelector: string;
}

const FIELDS: CheckboxField[] = [
  {
    flag: "weatherSyncDisabled",
    labelKey: "KRONOS.Scene.OptOut.Name",
    hintKey: "KRONOS.Scene.OptOut.Hint",
    checked: isSceneOptedOut,
    apply: setSceneOptOut,
    anchorSelector: '[name="weather"]',
  },
  {
    flag: "darknessControl",
    labelKey: "KRONOS.Scene.Darkness.Name",
    hintKey: "KRONOS.Scene.Darkness.Hint",
    checked: isDarknessControlled,
    apply: setDarknessControlled,
    // Sits under the darkness slider, which is where a GM looks for anything lighting-related.
    anchorSelector: '[name="environment.darknessLevel"], [name="darknessLevel"], [name="darkness"]',
  },
];

function buildCheckbox(scene: FoundryScene, field: CheckboxField): HTMLElement {
  const group = document.createElement("div");
  group.className = "form-group";

  const label = document.createElement("label");
  label.textContent = t(field.labelKey);

  const fields = document.createElement("div");
  fields.className = "form-fields";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = `flags.${MODULE_ID}.${field.flag}`;
  checkbox.checked = field.checked(scene);
  // Written immediately rather than on form submit: the scene config may be closed without
  // saving, and a half-applied setting is worse than none.
  checkbox.addEventListener("change", () => void field.apply(scene, checkbox.checked));

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = t(field.hintKey);

  fields.append(checkbox);
  group.append(label, fields, hint);
  return group;
}

/**
 * Adds our per-scene toggles to the scene configuration, beside the core fields they relate to.
 *
 * Both are per-scene rather than global on purpose: interiors and anything underground should
 * neither be rained on nor lit up at noon, and they outnumber outdoor scenes.
 */
export function injectSceneFields(app: unknown, rendered: unknown): void {
  const root = toElement(rendered);
  const scene = (app as { document?: FoundryScene } | null)?.document;
  if (!root || !scene) return;

  for (const field of FIELDS) {
    // The config re-renders on tab changes; adding a second copy each time would be visible.
    if (root.querySelector(`[name="flags.${MODULE_ID}.${field.flag}"]`)) continue;

    const anchor = root.querySelector<HTMLElement>(field.anchorSelector)?.closest(".form-group");
    if (!anchor) continue;

    anchor.after(buildCheckbox(scene, field));
  }
}
