/**
 * Module id. Also the namespace for every `game.settings` key and every document flag we
 * write, so it must stay identical to the manifest's `id`: a mismatch breaks every setting
 * and flag read at runtime without producing an error at load time.
 */
export const MODULE_ID = "pf2e-calendar-bar";

/** The system this module is built against. Nothing here is expected to work without it. */
export const REQUIRED_SYSTEM = "pf2e";
