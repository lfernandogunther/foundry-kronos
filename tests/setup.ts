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
});
