import { solarEvents } from "../time/sun.js";

/**
 * Scene darkness across the day.
 *
 * The ramps are centred on the sunrise and sunset already computed for that day and latitude, so
 * seasonal drift is inherited rather than modelled a second time: a midwinter dusk simply arrives
 * earlier, because sunset does.
 */

export interface DarknessProfile {
  /** Darkness at the dead of night, 0-1. */
  night: number;
  /** Darkness at midday, 0-1. */
  day: number;
  /** Minutes the transition takes, centred on sunrise and on sunset. */
  twilightMinutes: number;
}

export const DEFAULT_PROFILE: DarknessProfile = {
  night: 1,
  day: 0,
  twilightMinutes: 90,
};

/** Eases at both ends instead of cornering, which a linear ramp does visibly. */
function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * @param minuteOfDay 0 at midnight, 1439 at 23:59
 * @param dayOfYear   1-366, for the seasonal sun position
 */
export function darknessAt(
  minuteOfDay: number,
  dayOfYear: number,
  latitudeDeg: number,
  profile: DarknessProfile = DEFAULT_PROFILE,
): number {
  const { sunrise, sunset, polar } = solarEvents(dayOfYear, latitudeDeg);

  // Above the polar circles the sun may not cross the horizon at all, and there is no ramp to draw.
  if (polar === "day") return profile.day;
  if (polar === "night") return profile.night;

  const half = profile.twilightMinutes / 2;

  // Before dawn and after dusk, night. Between the two ramps, day.
  if (minuteOfDay <= sunrise - half) return profile.night;
  if (minuteOfDay >= sunset + half) return profile.night;
  if (minuteOfDay >= sunrise + half && minuteOfDay <= sunset - half) return profile.day;

  const lit =
    minuteOfDay < sunrise + half
      ? smoothstep((minuteOfDay - (sunrise - half)) / profile.twilightMinutes)
      : 1 - smoothstep((minuteOfDay - (sunset - half)) / profile.twilightMinutes);

  return profile.night + (profile.day - profile.night) * lit;
}

/**
 * Whether a change is worth writing to the scene.
 *
 * Each write is a document update broadcast to every client, so the plateaus either side of the
 * ramps should produce none at all rather than a stream of identical values.
 */
export function isWorthWriting(current: number, next: number, epsilon = 0.01): boolean {
  return Math.abs(current - next) >= epsilon;
}
