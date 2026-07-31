import { advances, settings, world } from "./globals.js";

// Everything below this line must be imported after the stubs above.
import { getCalendarBar } from "../../src/apps/calendar-bar.js";
import { MODULE_ID } from "../../src/constants.js";
import { bundledCalendar, setCalendar } from "../../src/time/calendar.js";
import { getWorldDate } from "../../src/time/clock.js";
import { isWeatherCondition, WEATHER_CONDITIONS } from "../../src/weather/generator.js";

/**
 * Mounts the real panel against the real stylesheet, in whatever state the query string asks for.
 *
 * It goes through the same `_renderHTML` and `_onRender` the application calls, so what is on screen
 * is what a world would show, and gestures can be driven rather than only looked at. Anything that
 * only a running Foundry provides — the dialog frame, the settings sheet, hooks, scene writes — is
 * outside what this can tell you, and no amount of stubbing changes that.
 */

interface PanelState {
  isGM: boolean;
  grid: boolean;
  size: string;
  compact: boolean;
  weather: boolean;
  calendar: string;
  worldTime: number;
  condition: string | null;
}

type Bar = {
  _renderHTML(): Promise<HTMLElement>;
  _onRender(): void;
  element: HTMLElement;
  rendered: boolean;
};

const params = new URLSearchParams(location.search);

/** `?date=2025-06-21T14:30` reads better than a raw world time, and `?at=` still works. */
function worldTimeFromParams(): number {
  const at = params.get("at");
  if (at !== null && Number.isFinite(Number(at))) return Number(at);

  const date = params.get("date");
  if (date) {
    const parsed = Date.parse(date.includes("T") ? `${date}Z` : `${date}T12:00:00Z`);
    if (!Number.isNaN(parsed)) return parsed / 1000;
  }

  // Late evening, so the night icons and the handle near the right edge are the default view.
  return 79_200;
}

function requested(): PanelState {
  return {
    isGM: params.get("player") !== "1",
    grid: params.get("grid") === "1",
    size: params.get("size") ?? "large",
    compact: params.get("compact") === "1",
    weather: params.get("weather") !== "0",
    calendar: params.get("calendar") ?? "golarion-ar",
    worldTime: worldTimeFromParams(),
    condition: params.get("condition"),
  };
}

/** Puts the stubs into the requested state and returns freshly built markup. */
async function build(state: PanelState): Promise<HTMLElement> {
  world.isGM = state.isGM;
  world.worldTime = state.worldTime;

  // Falls back with a warning on an unknown id, which is the behaviour a world gets too.
  setCalendar(bundledCalendar(state.calendar));

  settings.set(`${MODULE_ID}.barSize`, state.size);
  settings.set(`${MODULE_ID}.barCompact`, state.compact);
  settings.set(`${MODULE_ID}.weatherEnabled`, state.weather);
  settings.set(`${MODULE_ID}.clockRunning`, true);

  // Forcing a condition goes through the override, which is keyed to the day — so the day has to be
  // resolved first. That is also the only way to see all eight icons without hunting for the dates
  // the generator happens to produce them on.
  if (state.condition && !isWeatherCondition(state.condition)) {
    console.warn(`harness: "${state.condition}" is not a weather condition; using generated weather`);
  }

  if (isWeatherCondition(state.condition)) {
    settings.set(`${MODULE_ID}.weatherOverride`, {
      dateKey: getWorldDate().dayKey,
      condition: state.condition,
      tempMin: 2,
      tempMax: 11,
    });
  } else {
    settings.set(`${MODULE_ID}.weatherOverride`, null);
  }

  const bar = getCalendarBar();
  bar.grid = { open: state.grid, viewedMonth: null, selectedDay: null };
  return (bar as unknown as Bar)._renderHTML();
}

/** One panel, live, with its listeners bound. */
async function mountLive(state: PanelState): Promise<void> {
  const root = document.createElement("div");
  root.id = MODULE_ID;
  document.body.append(root);

  const bar = getCalendarBar() as unknown as Bar;
  root.replaceChildren(await build(state));

  bar.element = root;
  bar.rendered = true;
  bar._onRender();

  // The application positions itself over a canvas; on this page it just sits in the flow.
  root.style.position = "static";

  Object.assign(globalThis, { KRONOS: { bar, advances, world, settings } });
}

/**
 * Every state worth eyeballing at once, as markup only — no listeners, nothing to drive.
 *
 * All of it inside one `#foundry-kronos`, because that id is what the stylesheet is scoped to and
 * repeating it per panel would mean a page full of duplicate ids.
 */
async function mountGallery(base: PanelState): Promise<void> {
  const container = document.createElement("div");
  container.id = MODULE_ID;
  container.className = "harness-gallery";
  document.body.append(container);

  // The six size-by-collapse states first, GM and player, because that is the grid a size change has
  // to be judged against.
  const sizes = ["large", "medium", "small"];
  const cases: [string, Partial<PanelState>][] = [
    ...sizes.flatMap((size): [string, Partial<PanelState>][] => [
      [`${size} — GM`, { size }],
      [`${size} — GM, collapsed`, { size, compact: true }],
      [`${size} — player`, { size, isGM: false }],
      [`${size} — player, collapsed`, { size, isGM: false, compact: true }],
    ]),
    ["Weather off", { weather: false }],
    ["Tarlan, a festival at noon", { calendar: "tarlan", worldTime: Date.parse("2025-01-01T12:00:00Z") / 1000 }],
    ...WEATHER_CONDITIONS.map(
      (condition): [string, Partial<PanelState>] => [`Condition: ${condition}`, { condition, worldTime: 43_200 }],
    ),
    ...WEATHER_CONDITIONS.slice(0, 2).map(
      (condition): [string, Partial<PanelState>] => [`Condition: ${condition}, after dark`, { condition }],
    ),
  ];

  for (const [label, overrides] of cases) {
    const heading = document.createElement("h2");
    heading.className = "harness-label";
    heading.textContent = label;

    container.append(heading, await build({ ...base, ...overrides }));
  }
}

const state = requested();
void (params.get("gallery") === "1" ? mountGallery(state) : mountLive(state));
