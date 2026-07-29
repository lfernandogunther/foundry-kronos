/**
 * Hand-rolled ambient declarations for the slice of the Foundry API we actually use.
 *
 * Deliberately minimal and grown as needed rather than pulling in a full community type
 * package: the surface we touch is small, and v14 type packages lag the release.
 */

declare const Hooks: {
  on(hook: string, fn: (...args: unknown[]) => unknown): number;
  once(hook: string, fn: (...args: unknown[]) => unknown): number;
  off(hook: string, id: number): void;
  callAll(hook: string, ...args: unknown[]): boolean;
};

interface FoundryUser {
  id: string;
  isGM: boolean;
  active: boolean;
}

interface FoundryScene {
  id: string;
  name: string;
  weather: string;
  update(data: Record<string, unknown>): Promise<FoundryScene>;
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<FoundryScene>;
}

interface SettingRegistration {
  name?: string;
  hint?: string;
  scope: "world" | "client" | "user";
  config: boolean;
  type?: unknown;
  default?: unknown;
  choices?: Record<string, string>;
  range?: { min: number; max: number; step: number };
  requiresReload?: boolean;
  onChange?: (value: never) => void;
}

declare const game: {
  version: string;
  ready: boolean;
  system: { id: string; version: string };
  user: FoundryUser;
  users: { activeGM: FoundryUser | null };
  scenes: {
    viewed?: FoundryScene | null;
    active?: FoundryScene | null;
    current?: FoundryScene | null;
    contents: FoundryScene[];
  } | null;
  paused: boolean;
  combats?: { active?: { started: boolean } | null };
  i18n: {
    localize(key: string): string;
    format(key: string, data: Record<string, unknown>): string;
  };
  time: {
    worldTime: number;
    advance(seconds: number): Promise<number>;
  };
  settings: {
    get(namespace: string, key: string): unknown;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
    register(namespace: string, key: string, data: SettingRegistration): void;
    registerMenu(namespace: string, key: string, data: Record<string, unknown>): void;
  };
  /** PF2e system API. Present only when the pf2e system is active; shape is not a public contract. */
  pf2e?: {
    worldClock?: {
      /** A luxon DateTime. Typed structurally so we never import luxon ourselves. */
      worldTime?: { toJSDate?(): Date; toMillis?(): number };
      worldCreatedOn?: { toMillis?(): number } | string;
    };
  };
};

declare const CONFIG: {
  weatherEffects?: Record<string, { label?: string } | undefined>;
  /** PF2e system config. Same caveat as `game.pf2e`. */
  PF2E?: {
    worldClock?: Record<
      string,
      { yearOffset?: number; months?: string[]; weekdays?: string[]; era?: string } | undefined
    >;
  };
};

declare const ui: {
  notifications?: {
    info(message: string, options?: { permanent?: boolean }): void;
    warn(message: string, options?: { permanent?: boolean }): void;
    error(message: string, options?: { permanent?: boolean }): void;
  };
};

declare namespace foundry {
  namespace utils {
    function randomID(length?: number): string;
  }
  namespace applications {
    namespace api {
      class ApplicationV2 {
        constructor(options?: Record<string, unknown>);
        static DEFAULT_OPTIONS: Record<string, unknown>;
        readonly element: HTMLElement;
        readonly rendered: boolean;
        options: Record<string, unknown>;
        render(options?: boolean | Record<string, unknown>): Promise<this>;
        close(options?: Record<string, unknown>): Promise<this>;
        setPosition(position?: Record<string, unknown>): void;
        protected _renderHTML(
          context: Record<string, unknown>,
          options: Record<string, unknown>,
        ): Promise<HTMLElement>;
        protected _replaceHTML(
          result: HTMLElement,
          content: HTMLElement,
          options: Record<string, unknown>,
        ): void;
        protected _prepareContext(
          options: Record<string, unknown>,
        ): Promise<Record<string, unknown>>;
        protected _onRender(
          context: Record<string, unknown>,
          options: Record<string, unknown>,
        ): void;
      }
      class DialogV2 {
        /** Injects a confirmation button of its own alongside any passed in. */
        static prompt(options: Record<string, unknown>): Promise<unknown>;
        /** Renders exactly the buttons it is given. */
        static wait(options: Record<string, unknown>): Promise<unknown>;
      }
    }
  }
}
