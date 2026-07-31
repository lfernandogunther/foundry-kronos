/**
 * Stand-ins for the Foundry globals, for the development harness.
 *
 * Imported before anything from `src/`, and that order is load-bearing: `calendar-bar.ts` subclasses
 * `ApplicationV2` at module scope, so `foundry` has to exist before it is imported. ES imports are
 * hoisted, which is why these live in their own module rather than at the top of `main.ts`.
 *
 * Distinct from `tests/setup.ts` on purpose. That one is deliberately inert — it exists only to make
 * the import graph loadable — while this one has to answer settings reads with chosen values so a
 * page can show the panel in a state the world is not currently in.
 */

import EN from "../../lang/en.json" with { type: "json" };

/** Settings reads answered from here. Anything absent falls through to the module's own default. */
export const settings = new Map<string, unknown>();

/** Every `game.time.advance` the panel asks for, so a gesture's writes can be counted. */
export const advances: number[] = [];

export interface HarnessWorld {
  isGM: boolean;
  worldTime: number;
  paused: boolean;
  activeGM: boolean;
}

export const world: HarnessWorld = {
  isGM: true,
  worldTime: 0,
  paused: false,
  activeGM: true,
};

class ApplicationV2Stub {
  static DEFAULT_OPTIONS: Record<string, unknown> = {};
  element = null as unknown as HTMLElement;
  rendered = false;
  options: Record<string, unknown> = {};

  /** Mirrors the real one closely enough to matter: rebuild the markup, replace the root's children. */
  async render(): Promise<this> {
    const self = this as unknown as { _renderHTML(): Promise<HTMLElement>; element: HTMLElement };
    if (self.element) self.element.replaceChildren(await self._renderHTML());
    return this;
  }

  async close(): Promise<this> {
    return this;
  }
}

const user = {
  id: "harness",
  get isGM(): boolean {
    return world.isGM;
  },
  active: true,
};

Object.assign(globalThis, {
  foundry: {
    applications: { api: { ApplicationV2: ApplicationV2Stub, DialogV2: { wait: async (): Promise<null> => null } } },
    utils: { randomID: (): string => "harness" },
  },
  CONFIG: { weatherEffects: {} },
  ui: { notifications: undefined },
  Hooks: { on: (): number => 0, once: (): number => 0, off: (): void => {}, callAll: (): boolean => true },
  canvas: null,
  game: {
    version: "14",
    ready: true,
    system: { id: "pf2e", version: "6" },
    user,
    users: {
      get activeGM(): typeof user | null {
        return world.activeGM ? user : null;
      },
    },
    scenes: null,
    get paused(): boolean {
      return world.paused;
    },
    combats: { active: null },
    modules: { get: (): undefined => undefined },
    time: {
      get worldTime(): number {
        return world.worldTime;
      },
      advance: async (seconds: number): Promise<number> => {
        advances.push(seconds);
        world.worldTime += seconds;
        return world.worldTime;
      },
    },
    settings: {
      // The world creation timestamp a calendar epoch resolves against. Zero makes a world time
      // simply seconds since 1970, so a date in a query string converts with Date.parse.
      get: (namespace: string, key: string): unknown =>
        namespace === "pf2e" && key === "worldClock.worldCreatedOn" ? 0 : settings.get(`${namespace}.${key}`),
      set: async (namespace: string, key: string, value: unknown): Promise<unknown> => {
        settings.set(`${namespace}.${key}`, value);
        return value;
      },
      register: (): void => {},
      registerMenu: (): void => {},
    },
    // The real language file, so widths on the page are the widths a world actually gets.
    i18n: {
      localize: (key: string): string => (EN as Record<string, string>)[key] ?? key,
      format: (key: string): string => (EN as Record<string, string>)[key] ?? key,
    },
  },
});
