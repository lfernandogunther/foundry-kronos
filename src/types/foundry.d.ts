/**
 * Hand-rolled ambient declarations for the slice of the Foundry API we actually use.
 *
 * Deliberately minimal and grown per task rather than pulling in a full community type
 * package: the surface we touch is small, and v14 type packages lag the release.
 */

declare const Hooks: {
  on(hook: string, fn: (...args: never[]) => unknown): number;
  once(hook: string, fn: (...args: never[]) => unknown): number;
  off(hook: string, id: number): void;
};

declare const game: {
  version: string;
  system: { id: string; version: string };
  ready: boolean;
};

declare const ui: {
  notifications?: {
    warn(message: string, options?: { permanent?: boolean }): void;
    error(message: string, options?: { permanent?: boolean }): void;
  };
};
