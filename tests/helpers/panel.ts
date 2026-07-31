import EN from "../../lang/en.json" with { type: "json" };
import { CalendarBar } from "../../src/apps/calendar-bar.js";
import { MODULE_ID } from "../../src/constants.js";
import { BUNDLED_CALENDAR, bundledCalendar, type CalendarDefinition, setCalendar } from "../../src/time/calendar.js";

/**
 * Renders the panel under a described world, then puts every global back.
 *
 * The globals `tests/setup.ts` installs are deliberately inert — enough to make the import graph
 * loadable and nothing more — so a test that wants a GM, a clock reading and a calendar has to say
 * so. Anything left unstated falls through to the module's own default, which is what makes these
 * tests read as "given a player" rather than as a wall of setup.
 */

export interface World {
  isGM?: boolean;
  /** Seconds since 1970: the stub world is created at the Unix epoch. */
  worldTime?: number;
  calendar?: CalendarDefinition | "golarion-ar" | "tarlan";
  clockRunning?: boolean;
  weatherEnabled?: boolean;
  compact?: boolean;
  paused?: boolean;
  /** Whether this client is the active GM, which the clock's halt reason depends on. */
  activeGM?: boolean;
  /** Anything else a setting read should answer with, keyed without the module namespace. */
  settings?: Record<string, unknown>;
}

const resolveCalendar = (calendar: World["calendar"]): CalendarDefinition =>
  typeof calendar === "string" ? bundledCalendar(calendar) : (calendar ?? BUNDLED_CALENDAR);

/**
 * Builds the panel's markup for a world.
 *
 * Returns the root the application would hand to `_replaceHTML`, so a query against it is a query
 * against exactly what a client would be shown — including what is *absent*, which is the point for
 * the player case.
 */
export async function renderPanel(world: World = {}): Promise<HTMLElement> {
  const previousGame = game;
  const user = { id: "test", isGM: world.isGM ?? true, active: true };

  const values: Record<string, unknown> = {
    clockRunning: world.clockRunning ?? false,
    weatherEnabled: world.weatherEnabled ?? true,
    barCompact: world.compact ?? false,
    ...world.settings,
  };

  Object.assign(globalThis, {
    game: {
      ...previousGame,
      user,
      users: { activeGM: (world.activeGM ?? true) ? user : null },
      paused: world.paused ?? false,
      combats: { active: null },
      time: { worldTime: world.worldTime ?? 0, advance: async (): Promise<number> => 0 },
      // The real language file rather than the inert stub, so what lands in the DOM is the text a
      // world shows. It also makes a missing string visible as a leftover key.
      i18n: {
        localize: (key: string): string => (EN as Record<string, string>)[key] ?? key,
        format: (key: string): string => (EN as Record<string, string>)[key] ?? key,
      },
      settings: {
        ...previousGame.settings,
        get: (namespace: string, key: string): unknown => {
          // The world creation timestamp an epoch resolves against; zero makes a world time simply
          // seconds since 1970.
          if (namespace === "pf2e" && key === "worldClock.worldCreatedOn") return 0;
          if (namespace !== MODULE_ID) return undefined;
          return values[key];
        },
      },
    },
  });

  setCalendar(resolveCalendar(world.calendar));

  try {
    // `_renderHTML` is protected; a test is allowed to reach it, and going through it rather than
    // through a copy of it is what keeps these assertions about the real panel.
    const bar = new CalendarBar() as unknown as { _renderHTML(): Promise<HTMLElement> };
    return await bar._renderHTML();
  } finally {
    Object.assign(globalThis, { game: previousGame });
    setCalendar(BUNDLED_CALENDAR);
  }
}

/** Every element matching a selector, as an array, because NodeList is awkward to assert against. */
export const all = (root: HTMLElement, selector: string): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>(selector),
];

export const one = (root: HTMLElement, selector: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(selector);
