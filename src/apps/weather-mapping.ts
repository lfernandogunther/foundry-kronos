import { MODULE_ID } from "../constants.js";
import { getWeatherEffectMap, setWeatherEffectMap } from "../settings.js";
import { WEATHER_CONDITIONS } from "../weather/generator.js";
import { defaultWeatherEffectMap } from "../weather/scene-sync.js";

const t = (key: string): string => game.i18n?.localize(key) ?? key;

/**
 * Editor for which scene ambience each weather condition applies.
 *
 * The options come from `CONFIG.weatherEffects` as it stands in this world, so ambiences
 * registered by other modules appear here without this module knowing anything about them.
 */
export class WeatherMappingApp extends foundry.applications.api.ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-weather-mapping`,
    tag: "form",
    window: { title: "PF2ECALENDARBAR.Mapping.Title", contentClasses: ["standard-form"] },
    position: { width: 460 },
  };

  protected override async _renderHTML(): Promise<HTMLElement> {
    const configured = getWeatherEffectMap();
    const fallback = defaultWeatherEffectMap();
    const effects = Object.entries(CONFIG.weatherEffects ?? {});

    const root = document.createElement("div");
    root.className = "pcb-mapping";

    const note = document.createElement("p");
    note.className = "notes";
    note.textContent = t("PF2ECALENDARBAR.Mapping.Hint");
    root.append(note);

    for (const condition of WEATHER_CONDITIONS) {
      const group = document.createElement("div");
      group.className = "form-group";

      const label = document.createElement("label");
      label.htmlFor = `pcb-map-${condition}`;
      label.textContent = t(`PF2ECALENDARBAR.Weather.${condition}`);

      const select = document.createElement("select");
      select.id = `pcb-map-${condition}`;
      select.name = condition;

      const current = configured[condition] ?? fallback[condition] ?? "";

      const none = document.createElement("option");
      none.value = "";
      none.textContent = t("PF2ECALENDARBAR.Mapping.NoEffect");
      none.selected = current === "";
      select.append(none);

      for (const [key, config] of effects) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = config?.label ? `${t(config.label)} (${key})` : key;
        option.selected = key === current;
        select.append(option);
      }

      group.append(label, select);
      root.append(group);
    }

    const footer = document.createElement("footer");
    footer.className = "form-footer";
    const save = document.createElement("button");
    save.type = "button";
    save.dataset["action"] = "save-mapping";
    save.textContent = t("PF2ECALENDARBAR.Mapping.Save");
    footer.append(save);
    root.append(footer);

    return root;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  protected override _onRender(): void {
    this.element.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.dataset["action"] !== "save-mapping") return;
      void this.#save();
    });
  }

  async #save(): Promise<void> {
    const map: Record<string, string> = {};
    for (const condition of WEATHER_CONDITIONS) {
      const select = this.element.querySelector<HTMLSelectElement>(`select[name="${condition}"]`);
      map[condition] = select?.value ?? "";
    }
    await setWeatherEffectMap(map);
    await this.close();
  }
}
