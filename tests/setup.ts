/**
 * Minimal stand-ins for the Foundry globals.
 *
 * Importing almost anything reaches a module that subclasses `ApplicationV2` at load time, which
 * needs `foundry` to exist before any test runs. These are deliberately inert: nothing here is
 * exercised by a test, it only makes the import graph loadable outside a browser.
 */

class ApplicationV2Stub {
  static DEFAULT_OPTIONS: Record<string, unknown> = {};
  element = null as unknown as HTMLElement;
  rendered = false;
  options: Record<string, unknown> = {};
  async render(): Promise<this> {
    return this;
  }
  async close(): Promise<this> {
    return this;
  }
}

class DialogV2Stub {
  static async prompt(): Promise<unknown> {
    return null;
  }
  static async wait(): Promise<unknown> {
    return null;
  }
}

Object.assign(globalThis, {
  foundry: {
    applications: { api: { ApplicationV2: ApplicationV2Stub, DialogV2: DialogV2Stub } },
    utils: { randomID: (): string => "stub" },
  },
  CONFIG: { weatherEffects: {} },
  ui: { notifications: undefined },
  game: {
    /**
     * A world created at the Unix epoch, so a world time is simply seconds since 1970 and a test can
     * name an instant with `Date.UTC(...) / 1000`. Every other setting reads as unset, which sends
     * the module's own accessors to their defaults.
     */
    settings: {
      get: (namespace: string, key: string): unknown =>
        namespace === "pf2e" && key === "worldClock.worldCreatedOn" ? 0 : undefined,
    },
    i18n: { localize: (key: string): string => key },
  },
});
