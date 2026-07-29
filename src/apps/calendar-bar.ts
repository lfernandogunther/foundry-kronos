import { MODULE_ID } from "../constants.js";
import {
  getBarPosition,
  getLatitude,
  getStepMultiplier,
  getStepUnit,
  isClockRunning,
  isWeatherEnabled,
  setBarPosition,
  setClockRunning,
  setStepUnit,
} from "../settings.js";
import { getWorldDate, type WorldDate } from "../time/pf2e-clock.js";
import { SEASON_ICONS, seasonOf } from "../time/season.js";
import { solarEvents } from "../time/sun.js";
import { haltReason } from "../time/ticker.js";
import { isStepUnit, secondsUntilTimeOfDay, STEP_UNITS, type StepUnit, stepSeconds } from "../time/units.js";
import { temperatureAt } from "../weather/generator.js";
import { weatherFor } from "../weather/state.js";
import { openWeatherOverride } from "./weather-override.js";

const t = (key: string): string => game.i18n?.localize(key) ?? key;

type JumpTarget = "sunrise" | "noon" | "sunset" | "midnight";

function targetMinutes(target: JumpTarget, date: WorldDate): number {
  if (target === "midnight") return 0;
  const events = solarEvents(date.dayOfYear, getLatitude());
  if (target === "sunrise") return events.sunrise;
  if (target === "noon") return events.noon;
  return events.sunset;
}

async function advance(seconds: number): Promise<void> {
  if (!game.user.isGM || seconds === 0) return;
  try {
    await game.time.advance(seconds);
  } catch (error) {
    console.error(`${MODULE_ID} | could not advance world time:`, error);
  }
}

function button(icon: string, action: string, tooltip: string, extra: Record<string, string> = {}): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "pcb-button";
  el.dataset["action"] = action;
  el.textContent = icon;
  el.setAttribute("aria-label", tooltip);
  el.title = tooltip;
  for (const [key, value] of Object.entries(extra)) el.dataset[key] = value;
  return el;
}

function readout(className: string, text: string, tooltip?: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = `pcb-readout ${className}`;
  el.textContent = text;
  if (tooltip) el.title = tooltip;
  return el;
}

/**
 * The floating time and weather bar.
 *
 * Frameless and positioned by hand rather than through the window manager: it is a persistent
 * strip rather than a window, and hand-positioning keeps it independent of the core UI layout,
 * which shifts between releases.
 */
export class CalendarBar extends foundry.applications.api.ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: MODULE_ID,
    window: { frame: false, positioned: false },
    classes: ["pcb-bar"],
  };

  #dragOffset: { x: number; y: number } | null = null;

  protected override async _renderHTML(): Promise<HTMLElement> {
    const date = getWorldDate();
    const root = document.createElement("div");
    root.className = "pcb-root";

    const season = seasonOf(date.month, date.day);
    root.append(readout("pcb-season", SEASON_ICONS[season], t(`PF2ECALENDARBAR.Season.${season}`)));

    const day = String(date.day).padStart(2, "0");
    root.append(readout("pcb-date", `${day} ${date.monthName}`, date.weekdayName));
    root.append(readout("pcb-year", String(date.year), date.era));
    root.append(
      readout("pcb-time", `${String(date.hour).padStart(2, "0")}:${String(date.minute).padStart(2, "0")}`),
    );

    if (isWeatherEnabled()) {
      const weather = weatherFor(date);
      const label = readout("pcb-weather", t(`PF2ECALENDARBAR.Weather.${weather.condition}`));
      const temperature = readout("pcb-temp", `${temperatureAt(date.hour, date.minute, weather)}°`);
      if (game.user.isGM) {
        label.classList.add("pcb-clickable");
        label.dataset["action"] = "override-weather";
        label.title = t("PF2ECALENDARBAR.Action.OverrideWeather");
        temperature.classList.add("pcb-clickable");
        temperature.dataset["action"] = "override-weather";
      }
      root.append(label, temperature);
    }

    if (!game.user.isGM) return root;

    const separator = document.createElement("span");
    separator.className = "pcb-separator";
    root.append(separator);

    const halt = haltReason();
    const running = isClockRunning();
    const pause = button(
      running ? "⏸" : "▶",
      "toggle-clock",
      running && halt !== null && halt !== "paused"
        ? t(`PF2ECALENDARBAR.Clock.Halted.${halt}`)
        : t(running ? "PF2ECALENDARBAR.Clock.Pause" : "PF2ECALENDARBAR.Clock.Run"),
    );
    pause.classList.toggle("pcb-active", running && halt === null);
    pause.classList.toggle("pcb-stalled", running && halt !== null);
    root.append(pause);

    const multiplier = getStepMultiplier();
    root.append(
      button("⏪", "step", t("PF2ECALENDARBAR.Action.StepBackMany"), { count: String(-multiplier) }),
      button("◀", "step", t("PF2ECALENDARBAR.Action.StepBackOne"), { count: "-1" }),
      button("🌅", "jump", t("PF2ECALENDARBAR.Action.Sunrise"), { target: "sunrise" }),
      button("☀", "jump", t("PF2ECALENDARBAR.Action.Noon"), { target: "noon" }),
    );

    const select = document.createElement("select");
    select.className = "pcb-unit";
    select.dataset["action"] = "set-unit";
    select.title = t("PF2ECALENDARBAR.Action.StepUnit");
    const unit = getStepUnit();
    for (const option of STEP_UNITS) {
      const el = document.createElement("option");
      el.value = option;
      el.textContent = t(`PF2ECALENDARBAR.Unit.${option}`);
      el.selected = option === unit;
      select.append(el);
    }
    root.append(select);

    root.append(
      button("🌇", "jump", t("PF2ECALENDARBAR.Action.Sunset"), { target: "sunset" }),
      button("🌙", "jump", t("PF2ECALENDARBAR.Action.Midnight"), { target: "midnight" }),
      button("▶", "step", t("PF2ECALENDARBAR.Action.StepForwardOne"), { count: "1" }),
      button("⏩", "step", t("PF2ECALENDARBAR.Action.StepForwardMany"), { count: String(multiplier) }),
    );

    return root;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  protected override _onRender(): void {
    const element = this.element;
    this.#applyStoredPosition(element);

    element.addEventListener("click", (event) => void this.#onClick(event));
    element.addEventListener("change", (event) => void this.#onChange(event));
    element.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
  }

  #applyStoredPosition(element: HTMLElement): void {
    const stored = getBarPosition();
    element.style.position = "fixed";
    if (stored) {
      element.style.left = `${stored.left}px`;
      element.style.top = `${stored.top}px`;
      element.style.bottom = "";
    } else {
      // Above the hotbar and clear of the scene controls, which is where the design sits it.
      element.style.left = "220px";
      element.style.bottom = "180px";
    }
  }

  async #onClick(event: Event): Promise<void> {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-action]");
    if (!target) return;

    const date = getWorldDate();
    switch (target.dataset["action"]) {
      case "toggle-clock":
        await setClockRunning(!isClockRunning());
        break;
      case "step": {
        const count = Number(target.dataset["count"] ?? 0);
        await advance(stepSeconds(getStepUnit(), count, date.utcMs));
        break;
      }
      case "jump": {
        const jump = target.dataset["target"] as JumpTarget | undefined;
        if (!jump) break;
        await advance(secondsUntilTimeOfDay(date.utcMs, targetMinutes(jump, date)));
        break;
      }
      case "override-weather":
        await openWeatherOverride(date);
        break;
    }
  }

  async #onChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement | null;
    if (select?.dataset["action"] !== "set-unit") return;
    const value: unknown = select.value;
    if (isStepUnit(value)) await setStepUnit(value as StepUnit);
  }

  /** Dragging moves the bar; the controls inside it must still be clickable. */
  #onPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, select, [data-action]")) return;

    const element = this.element;
    const bounds = element.getBoundingClientRect();
    this.#dragOffset = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };

    const onMove = (move: PointerEvent): void => {
      if (!this.#dragOffset) return;
      element.style.left = `${move.clientX - this.#dragOffset.x}px`;
      element.style.top = `${move.clientY - this.#dragOffset.y}px`;
      element.style.bottom = "";
    };

    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      this.#dragOffset = null;
      const final = element.getBoundingClientRect();
      void setBarPosition({ left: Math.round(final.left), top: Math.round(final.top) });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
}

let instance: CalendarBar | null = null;

export function getCalendarBar(): CalendarBar {
  instance ??= new CalendarBar();
  return instance;
}

/** Re-render only when it is already on screen, so this is safe to call from any hook. */
export function refreshCalendarBar(): void {
  if (instance?.rendered) void instance.render();
}
