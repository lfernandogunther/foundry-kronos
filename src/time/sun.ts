/**
 * Sunrise, solar noon and sunset for a day of the year at a given latitude.
 *
 * A standard declination approximation rather than a full ephemeris: it is accurate to a few
 * minutes, which is far finer than anything a session needs, and it keeps the whole thing to a
 * handful of arithmetic with no dependency.
 */

const MINUTES_PER_DAY = 1440;
const SOLAR_NOON_MINUTES = 720;

/** Earth's axial tilt, the amplitude of the declination swing over a year. */
const AXIAL_TILT_DEG = 23.44;

/** Day of year of the March equinox, where declination crosses zero going positive. */
const EQUINOX_DAY = 81;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

export interface SolarEvents {
  /** Minutes from midnight. */
  sunrise: number;
  noon: number;
  sunset: number;
  /**
   * Set at extreme latitudes where the sun does not cross the horizon at all. Sunrise and sunset
   * are still returned so callers always have a usable number, but they are nominal.
   */
  polar: "day" | "night" | null;
}

/** Solar declination in degrees for a day of the year. */
export function declination(dayOfYear: number): number {
  return AXIAL_TILT_DEG * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - EQUINOX_DAY));
}

export function solarEvents(dayOfYear: number, latitudeDeg: number): SolarEvents {
  const cosHourAngle = -Math.tan(toRadians(latitudeDeg)) * Math.tan(toRadians(declination(dayOfYear)));

  // Outside [-1, 1] the sun never reaches the horizon: midnight sun, or polar night.
  if (cosHourAngle <= -1) {
    return { sunrise: 0, noon: SOLAR_NOON_MINUTES, sunset: MINUTES_PER_DAY, polar: "day" };
  }
  if (cosHourAngle >= 1) {
    return { sunrise: SOLAR_NOON_MINUTES, noon: SOLAR_NOON_MINUTES, sunset: SOLAR_NOON_MINUTES, polar: "night" };
  }

  // The hour angle is half the daylight arc; 15° of rotation is one hour.
  const halfDayMinutes = (toDegrees(Math.acos(cosHourAngle)) / 15) * 60;
  return {
    sunrise: SOLAR_NOON_MINUTES - halfDayMinutes,
    noon: SOLAR_NOON_MINUTES,
    sunset: SOLAR_NOON_MINUTES + halfDayMinutes,
    polar: null,
  };
}

/**
 * Whether the sun is above the horizon at `minutes` past midnight.
 *
 * The panel draws a clear sky differently after dark, and "after dark" has to follow the same
 * seasonal sunrise and sunset the rest of the module does — a fixed pair of hours would show a sun
 * at nine in the evening in midwinter.
 */
export function isDaylight(dayOfYear: number, latitudeDeg: number, minutes: number): boolean {
  const { sunrise, sunset, polar } = solarEvents(dayOfYear, latitudeDeg);
  if (polar !== null) return polar === "day";
  return minutes >= sunrise && minutes < sunset;
}

/** Daylight length in minutes, for weather and temperature shaping. */
export function daylightMinutes(dayOfYear: number, latitudeDeg: number): number {
  const { sunrise, sunset } = solarEvents(dayOfYear, latitudeDeg);
  return sunset - sunrise;
}
