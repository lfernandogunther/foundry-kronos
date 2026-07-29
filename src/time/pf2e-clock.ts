import { MODULE_ID } from "../constants.js";

/**
 * The only file that touches PF2e internals.
 *
 * `game.pf2e.worldClock` and `CONFIG.PF2E.worldClock` are system implementation details, not a
 * public API, so every read here is feature-detected with a working fallback. If the system
 * changes shape, this file is the only one that needs attention.
 *
 * The conversion PF2e performs is: world creation timestamp + `worldTime` seconds, read in UTC,
 * with a fixed offset added to the year. Reproducing that formula — rather than reading the
 * system's already-formatted output — is what lets us convert *arbitrary* times, which the jump
 * and step controls need.
 */

const MS_PER_SECOND = 1000;

let warnedMissingCreatedOn = false;

/**
 * When PF2e is absent or its setting is unreadable we still need *some* origin, or every date
 * becomes NaN. The Unix epoch is an arbitrary but stable choice; the warning makes clear the
 * displayed date is not authoritative.
 */
function fallbackCreatedOnMs(): number {
  if (!warnedMissingCreatedOn) {
    warnedMissingCreatedOn = true;
    console.warn(
      `${MODULE_ID} | could not read the PF2e world creation date; dates will not match the system World Clock`,
    );
  }
  return 0;
}

/**
 * Reads PF2e's world creation timestamp, accepting each shape the setting has plausibly taken, and
 * returns null rather than a substitute when there is nothing to read.
 *
 * Callers that only need dates to be self-consistent can fall back silently. A caller anchoring a
 * calendar cannot: substituting an origin there moves every date in the world, so it needs to know.
 */
export function readWorldCreatedOnMs(): number | null {
  let raw: unknown;
  try {
    raw = game.settings.get("pf2e", "worldClock.worldCreatedOn");
  } catch {
    return null;
  }

  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof raw === "number") return raw;
  if (raw instanceof Date) return raw.getTime();

  // Luxon DateTime, should the system ever hand one back directly.
  const asLuxon = raw as { toMillis?: () => number } | null;
  if (asLuxon && typeof asLuxon.toMillis === "function") return asLuxon.toMillis();

  return null;
}

export function getWorldCreatedOnMs(): number {
  return readWorldCreatedOnMs() ?? fallbackCreatedOnMs();
}

export function worldTimeToUtcMs(worldTime: number): number {
  return getWorldCreatedOnMs() + worldTime * MS_PER_SECOND;
}

/** Inverse of {@link worldTimeToUtcMs}, for turning a target instant into a `game.time.advance` delta. */
export function utcMsToWorldTime(utcMs: number): number {
  return Math.round((utcMs - getWorldCreatedOnMs()) / MS_PER_SECOND);
}

/**
 * Compares our reconstruction against the system's own clock and reports any disagreement.
 *
 * The whole point of reproducing PF2e's formula is that the two never diverge, so a mismatch is
 * a real defect worth surfacing loudly rather than a cosmetic difference.
 *
 * This compares the *instant*, not the displayed date, so it says nothing about a calendar carrying
 * its own months — those are expected to read differently and calling this for one would report
 * agreement while the bar plainly disagrees. Ask only for the Gregorian structure.
 */
export function verifyAgainstSystemClock(): { agrees: boolean; detail: string } {
  const systemClock = game.pf2e?.worldClock;
  const systemTime = systemClock?.worldTime;
  if (!systemTime || typeof systemTime.toMillis !== "function") {
    return { agrees: true, detail: "system World Clock unavailable; nothing to compare against" };
  }

  const ours = worldTimeToUtcMs(game.time.worldTime);
  const theirs = systemTime.toMillis();
  const driftSeconds = Math.abs(ours - theirs) / MS_PER_SECOND;

  // Sub-second drift is just rounding between the two representations.
  if (driftSeconds < 1) return { agrees: true, detail: "matches the system World Clock" };

  const detail = `disagrees with the system World Clock by ${Math.round(driftSeconds)}s (ours ${new Date(ours).toISOString()}, system ${new Date(theirs).toISOString()})`;
  console.warn(`${MODULE_ID} | ${detail}`);
  return { agrees: false, detail };
}
