import { MODULE_ID } from "../constants.js";
import {
  getBarPosition,
  getBarSize,
  getLatitude,
  getStepMultiplier,
  getStepUnit,
  isBarCompact,
  isClockRunning,
  isWeatherEnabled,
  setBarCompact,
  setBarPosition,
  setClockRunning,
  setStepUnit,
} from "../settings.js";
import { getWorldDate, normaliseMonth, secondsToTimeOfDay, worldTimeAtDate, type WorldDate } from "../time/clock.js";
import { isDaylight } from "../time/sun.js";
import { haltReason } from "../time/ticker.js";
import { isStepUnit, STEP_UNITS, type StepUnit, stepSeconds } from "../time/units.js";
import { temperatureAt } from "../weather/generator.js";
import { weatherFor } from "../weather/state.js";
import { ICON, weatherIcon } from "./icons.js";
import { monthView } from "./month-grid.js";
import { sizeClass } from "./size.js";
import { minutesAt, timelineLayout } from "./timeline.js";
import { openWeatherOverride } from "./weather-override.js";

const t = (key: string): string => game.i18n?.localize(key) ?? key;

/** What the month grid needs to remember between renders. Nothing here is persisted. */
export interface GridState {
  open: boolean;
  /** null follows the clock; a value pins the view to that month. */
  viewedMonth: { year: number; month: number } | null;
  selectedDay: number | null;
}

const pad = (value: number): string => String(value).padStart(2, "0");

const MINUTES_PER_DAY = 1440;

/** Where along the track the pointer is, as a time of day. */
function minutesFromPointer(clientX: number, track: HTMLElement): number {
  const rect = track.getBoundingClientRect();
  // A zero-width track cannot be read from; midnight is the harmless answer.
  return rect.width > 0 ? minutesAt((clientX - rect.left) / rect.width) : 0;
}

async function advance(seconds: number): Promise<void> {
  if (!game.user.isGM || seconds === 0) return;
  try {
    await game.time.advance(seconds);
  } catch (error) {
    console.error(`${MODULE_ID} | could not advance world time:`, error);
  }
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** A glyph from the bundled subset. Always paired with a label, so a font failure is not fatal. */
function icon(glyph: string): HTMLSpanElement {
  return element("span", "kronos-icon", glyph);
}

/**
 * The base for every control. Variants add their own class rather than sharing one, so a marker
 * cannot pick up the hover state of a control panel button.
 */
function button(glyph: string, action: string, tooltip: string, extra: Record<string, string> = {}): HTMLButtonElement {
  const el = element("button", "kronos-button");
  el.type = "button";
  el.dataset["action"] = action;
  el.append(icon(glyph));
  el.setAttribute("aria-label", tooltip);
  el.title = tooltip;
  for (const [key, value] of Object.entries(extra)) el.dataset[key] = value;
  return el;
}

/**
 * The floating time and weather panel.
 *
 * Frameless and positioned by hand rather than through the window manager: it is a persistent
 * strip rather than a window, and hand-positioning keeps it independent of the core UI layout,
 * which shifts between releases.
 */
export class CalendarBar extends foundry.applications.api.ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: MODULE_ID,
    window: { frame: false, positioned: false },
    classes: ["kronos-bar"],
  };

  #dragOffset: { x: number; y: number } | null = null;
  #timelineDrag = false;
  #listening = false;

  /**
   * The month grid's state: read by the render, written by the click handler.
   *
   * Held here rather than in settings. The grid is something a GM opens to look a date up, not a layout
   * preference, so it need not survive a reload — and a selection certainly should not, nor should it be
   * shared with another GM.
   *
   * `viewedMonth` null means "follow the clock". An arrow pins it to a year and month, which is what
   * stops a clock tick pulling someone out of the month they are reading.
   *
   * Not private, because a `#` field would put the grid's markup out of reach of any test — and the way
   * this round regresses is in the markup.
   */
  grid: GridState = { open: false, viewedMonth: null, selectedDay: null };

  /**
   * Whether a pointer gesture is in progress.
   *
   * A re-render replaces the whole panel, which would detach the element a gesture is holding — the
   * clock ticks every ten seconds, so a slow drag would otherwise be interrupted mid-way.
   */
  get gesturing(): boolean {
    return this.#dragOffset !== null || this.#timelineDrag;
  }

  protected override async _renderHTML(): Promise<HTMLElement> {
    const date = getWorldDate();
    const isGM = game.user.isGM;

    const wrapper = element("div", "kronos-wrapper");
    wrapper.classList.add(sizeClass(getBarSize()));
    wrapper.classList.toggle("kronos-compact", isBarCompact());

    // Outside the panel's right border, so collapsing it does not move the control it was collapsed
    // with. Everyone gets one: how much of the panel to keep on screen is a per-client choice.
    const compact = isBarCompact();
    const tab = button(
      compact ? ICON.expand : ICON.collapse,
      "toggle-compact",
      t(compact ? "KRONOS.Action.Expand" : "KRONOS.Action.Collapse"),
    );
    tab.classList.add("kronos-tab");
    wrapper.append(tab);

    const panel = element("div", "kronos-panel");
    // A player gets no timeline at all. It carried no control they could use, and the clock states
    // the time in figures while the weather icon already shows whether the sun is up — so what was
    // left was decoration on the half of the card that had to give way.
    if (isGM) panel.append(this.#timeline(date));
    panel.append(this.#controls(date, isGM));
    if (isGM && this.grid.open) panel.append(this.#monthGrid(date));
    wrapper.append(panel);

    return wrapper;
  }

  /**
   * One in-world day, midnight to midnight, with the markers to set the clock from.
   *
   * Built for a GM and nobody else, so nothing in here is conditional: the markers are always drawn
   * and the track always carries its action. The `data-action` is also what keeps the panel-drag
   * handler from treating the track as background.
   */
  #timeline(date: WorldDate): HTMLElement {
    const layout = timelineLayout(date, getLatitude());
    const container = element("div", "kronos-timeline");

    const markers = element("div", "kronos-markers");
    for (const entry of layout.markers) {
      const marker = button(entry.icon, "set-time", t(entry.tooltip), {
        minutes: String(entry.minutes),
      });
      marker.classList.add("kronos-marker");
      marker.style.left = `${entry.percent}%`;
      markers.append(marker);
    }
    container.append(markers);

    const track = element("div", "kronos-track");
    track.dataset["action"] = "timeline";
    track.title = t("KRONOS.Action.Timeline");

    const handle = element("div", "kronos-handle");
    handle.style.left = `${layout.percent}%`;
    track.append(handle);

    const labels = element("div", "kronos-labels");
    for (const entry of layout.markers) {
      const label = element("span", "kronos-label", entry.label);
      label.style.left = `${entry.percent}%`;
      // Named rather than counted: the stylesheet hides two of these at the smallest size, and
      // `:nth-child(2)` would keep working right up until a marker is added or reordered.
      label.dataset["target"] = entry.target;
      labels.append(label);
    }

    container.append(track, labels);
    return container;
  }

  /**
   * A month at a time. GM-only, like the control that opens it.
   *
   * Clicking a day selects it and moves nothing — a month is wide enough that one click could put the
   * party three weeks forward, and every such move re-syncs scene darkness and weather and runs every
   * other module's `updateWorldTime` handler. Moving is the selected cell's own control.
   */
  #monthGrid(date: WorldDate): HTMLElement {
    const showing = this.grid.viewedMonth ?? { year: date.year, month: date.month };
    const view = monthView(showing.year, showing.month, date, this.grid.selectedDay);

    const section = element("div", "kronos-grid");

    const nav = element("div", "kronos-grid-nav");
    nav.append(button(ICON.previousMonth, "month", t("KRONOS.Action.PreviousMonth"), { step: "-1" }));

    const heading = element("div", "kronos-grid-heading", `${view.monthName} ${view.year}`);
    if (view.selected !== null) {
      // The smallest honest purpose for a selection while notes do not exist yet: say what was picked.
      const festival = getWorldDate(worldTimeAtDate(view.year, view.month, view.selected)).festival;
      heading.textContent = `${pad(view.selected)} ${view.monthName} ${view.year}${festival ? ` · ${festival}` : ""}`;
    }
    nav.append(heading, button(ICON.nextMonth, "month", t("KRONOS.Action.NextMonth"), { step: "1" }));
    section.append(nav);

    const grid = element("div", "kronos-grid-days");
    grid.style.gridTemplateColumns = `repeat(${view.weekdays.length}, 1fr)`;

    for (const name of view.weekdays) grid.append(element("div", "kronos-grid-weekday", name));

    // Day 1 sits under its own weekday, which is the whole reason the headers above mean anything.
    for (let blank = 0; blank < view.blanks; blank += 1) grid.append(element("div", "kronos-grid-blank"));

    for (const entry of view.days) {
      const cell = element("button", "kronos-grid-day");
      cell.type = "button";
      cell.setAttribute("aria-label", `${entry.day} ${view.monthName} — ${t("KRONOS.Action.SelectDay")}`);
      cell.title = t("KRONOS.Action.SelectDay");
      cell.dataset["action"] = "select-day";
      cell.dataset["day"] = String(entry.day);
      cell.classList.toggle("kronos-today", entry.isToday);
      cell.classList.toggle("kronos-selected", entry.isSelected);
      cell.append(element("span", "kronos-grid-number", String(entry.day)));

      if (entry.isSelected) {
        const go = button(ICON.goToDay, "go-to-day", t("KRONOS.Action.GoToDay"), { day: String(entry.day) });
        go.classList.add("kronos-grid-go");
        cell.append(go);
      }

      grid.append(cell);
    }

    section.append(grid);
    return section;
  }

  #controls(date: WorldDate, isGM: boolean): HTMLElement {
    const row = element("div", "kronos-controls");
    row.append(this.#clock(date), this.#date(date));

    if (isWeatherEnabled()) row.append(this.#weather(date, isGM));
    if (isGM) row.append(this.#timeControls());

    return row;
  }

  #clock(date: WorldDate): HTMLElement {
    const block = element("div", "kronos-clock");
    block.append(
      element("div", "kronos-time", `${pad(date.hour)}:${pad(date.minute)}`),
      element("div", "kronos-seconds", `${pad(date.second)}s`),
    );
    return block;
  }

  #date(date: WorldDate): HTMLElement {
    const block = element("div", "kronos-date");
    block.append(
      element("div", "kronos-weekday", date.weekdayName),
      element("div", "kronos-datum", `${pad(date.day)} ${date.monthName} (${date.year})`),
    );
    block.lastElementChild?.setAttribute("title", date.era);

    const tags = element("div", "kronos-tags");
    tags.append(element("span", "kronos-tag kronos-tag-season", t(`KRONOS.Season.${date.season}`)));

    // A holy day is worth saying out loud, and only the calendar knows which days those are.
    if (date.festival) {
      const festival = element("span", "kronos-tag kronos-tag-festival", date.festival);
      festival.prepend(icon(ICON.festival));
      festival.title = t("KRONOS.Festival");
      tags.append(festival);
    }

    block.append(tags);
    return block;
  }

  #weather(date: WorldDate, isGM: boolean): HTMLElement {
    const weather = weatherFor(date);
    const daylight = isDaylight(date.dayOfYear, getLatitude(), date.hour * 60 + date.minute);

    const block = element("div", "kronos-weather");
    block.append(icon(weatherIcon(weather.condition, daylight)));

    const readout = element("div", "kronos-weather-readout");
    readout.append(
      element("strong", "kronos-temp", `${temperatureAt(date.hour, date.minute, weather)}°C`),
      element("div", "kronos-condition", t(`KRONOS.Weather.${weather.condition}`)),
    );
    block.append(readout);

    if (isGM) {
      block.classList.add("kronos-clickable");
      block.dataset["action"] = "override-weather";
      block.title = t("KRONOS.Action.OverrideWeather");
    }

    return block;
  }

  #timeControls(): HTMLElement {
    const panel = element("div", "kronos-time-controls");

    const halt = haltReason();
    const running = isClockRunning();
    const pause = button(
      running ? ICON.pause : ICON.run,
      "toggle-clock",
      running && halt !== null && halt !== "paused"
        ? t(`KRONOS.Clock.Halted.${halt}`)
        : t(running ? "KRONOS.Clock.Pause" : "KRONOS.Clock.Run"),
    );
    pause.classList.toggle("kronos-active", running && halt === null);
    pause.classList.toggle("kronos-stalled", running && halt !== null);
    panel.append(pause);

    const multiplier = getStepMultiplier();
    const back = button(ICON.stepBackMany, "step", t("KRONOS.Action.StepBackMany"), {
      count: String(-multiplier),
    });
    const forward = button(ICON.stepForwardMany, "step", t("KRONOS.Action.StepForwardMany"), {
      count: String(multiplier),
    });
    // Hidden when the panel is collapsed, which is what the design drops first.
    for (const button of [back, forward]) button.classList.add("kronos-long-step");

    panel.append(back, button(ICON.stepBackOne, "step", t("KRONOS.Action.StepBackOne"), { count: "-1" }));

    const select = element("select", "kronos-unit");
    select.dataset["action"] = "set-unit";
    select.title = t("KRONOS.Action.StepUnit");
    const unit = getStepUnit();
    for (const option of STEP_UNITS) {
      const el = document.createElement("option");
      el.value = option;
      el.textContent = t(`KRONOS.Unit.${option}`);
      el.selected = option === unit;
      select.append(el);
    }
    panel.append(select);

    panel.append(button(ICON.stepForwardOne, "step", t("KRONOS.Action.StepForwardOne"), { count: "1" }), forward);

    const gridToggle = button(ICON.grid, "toggle-grid", t("KRONOS.Action.MonthGrid"));
    gridToggle.classList.toggle("kronos-active", this.grid.open);
    panel.append(gridToggle);

    const settings = button(ICON.settings, "open-settings", t("KRONOS.Action.Settings"));
    settings.classList.add("kronos-settings");
    panel.append(settings);

    return panel;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  protected override _onRender(): void {
    const element = this.element;
    this.#applyStoredPosition(element);

    // The root element survives a re-render while its contents are replaced, so listeners bound
    // here would stack up: after ten clock ticks one click would fire ten times. Bind once, and
    // rely on delegation to reach the newly built controls.
    if (this.#listening) return;
    this.#listening = true;

    element.addEventListener("click", (event) => void this.#onClick(event));
    element.addEventListener("change", (event) => void this.#onChange(event));
    element.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
  }

  #applyStoredPosition(element: HTMLElement): void {
    // A re-render mid-drag must not yank the panel back to its last saved spot.
    if (this.#dragOffset) return;

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
      case "toggle-grid":
        // Opening follows the clock and starts with nothing picked, so it never reopens somewhere else.
        this.grid = { open: !this.grid.open, viewedMonth: null, selectedDay: null };
        await this.render();
        break;
      case "month": {
        const step = Number(target.dataset["step"] ?? 0);
        const showing = this.grid.viewedMonth ?? { year: date.year, month: date.month };
        this.grid.viewedMonth = normaliseMonth(showing.year, showing.month + step);
        await this.render();
        break;
      }
      case "select-day": {
        const day = Number(target.dataset["day"]);
        // Selecting moves nothing, and clicking the picked day again unpicks it.
        this.grid.selectedDay = Number.isFinite(day) && this.grid.selectedDay !== day ? day : null;
        await this.render();
        break;
      }
      case "go-to-day": {
        const day = Number(target.dataset["day"]);
        if (!Number.isFinite(day)) break;
        const showing = this.grid.viewedMonth ?? { year: date.year, month: date.month };
        // Keeps the time of day, and goes through the same advance path as every other control.
        await advance(worldTimeAtDate(showing.year, showing.month, day, date.secondsIntoDay) - date.worldTime);
        break;
      }
      case "toggle-compact":
        await setBarCompact(!isBarCompact());
        await this.render();
        break;
      case "toggle-clock":
        await setClockRunning(!isClockRunning());
        break;
      case "step": {
        const count = Number(target.dataset["count"] ?? 0);
        await advance(stepSeconds(getStepUnit(), count, date.worldTime));
        break;
      }
      case "set-time": {
        const minutes = Number(target.dataset["minutes"]);
        if (Number.isFinite(minutes)) await advance(secondsToTimeOfDay(date.worldTime, minutes));
        break;
      }
      case "override-weather":
        await openWeatherOverride(date);
        break;
      case "open-settings":
        this.#openSettings();
        break;
    }
  }

  #openSettings(): void {
    const sheet = game.settings.sheet;
    if (!sheet) {
      console.error(`${MODULE_ID} | the settings application is unavailable`);
      return;
    }
    sheet.render(true);
  }

  async #onChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement | null;
    if (select?.dataset["action"] !== "set-unit") return;
    const value: unknown = select.value;
    if (isStepUnit(value)) await setStepUnit(value as StepUnit);
  }

  /**
   * Setting the time by pointer: a click anywhere on the track, or a drag of the handle.
   *
   * The handle is moved locally while the pointer is down and world time is written once, on release.
   * Writing on every move would broadcast a world update per pixel, and each one re-triggers darkness
   * sync and every module's `updateWorldTime` handler.
   */
  #onTimelineDown(event: PointerEvent, track: HTMLElement): void {
    const handle = track.querySelector<HTMLElement>(".kronos-handle");
    let minutes = minutesFromPointer(event.clientX, track);

    const show = (value: number): void => {
      if (handle) handle.style.left = `${(value / MINUTES_PER_DAY) * 100}%`;
    };

    const onMove = (move: PointerEvent): void => {
      minutes = minutesFromPointer(move.clientX, track);
      show(minutes);
    };

    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      this.#timelineDrag = false;

      // Read the clock now rather than at the start of the gesture: the ticker may have moved it, and
      // the target is a time of day either way.
      void advance(secondsToTimeOfDay(game.time.worldTime, minutes));
    };

    this.#timelineDrag = true;
    show(minutes);
    event.preventDefault();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /** Dragging moves the panel; the controls inside it must still be clickable. */
  #onPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;

    // The track carries an action only for a GM, so a player's pointer falls straight through to the
    // panel drag below.
    const track = target?.closest<HTMLElement>('.kronos-track[data-action="timeline"]');
    if (track) {
      this.#onTimelineDown(event, track);
      return;
    }

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
  if (instance?.rendered && !instance.gesturing) void instance.render();
}
