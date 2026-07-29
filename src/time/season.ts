export type Season = "winter" | "spring" | "summer" | "autumn";

/**
 * Northern-hemisphere season boundaries, as (month, day) the season *starts* on.
 *
 * Fixed dates rather than computed equinoxes: the real ones drift by a day either way, which no
 * one at the table will notice, and a fixed table is something a GM can reason about.
 */
const BOUNDARIES: ReadonlyArray<{ month: number; day: number; season: Season }> = [
  { month: 3, day: 20, season: "spring" },
  { month: 6, day: 21, season: "summer" },
  { month: 9, day: 22, season: "autumn" },
  { month: 12, day: 21, season: "winter" },
];

/** @param month 1-12 */
export function seasonOf(month: number, day: number): Season {
  let current: Season = "winter"; // January and February precede the first boundary.
  for (const boundary of BOUNDARIES) {
    if (month > boundary.month || (month === boundary.month && day >= boundary.day)) {
      current = boundary.season;
    }
  }
  return current;
}

export const SEASON_ICONS: Readonly<Record<Season, string>> = {
  winter: "❄",
  spring: "❀",
  summer: "☀",
  autumn: "🍂",
};

/** Fraction through the year used to shape seasonal weather: 0 at midwinter, 1 at midsummer. */
export function summerness(dayOfYear: number, daysInYear: number): number {
  // Peaks around the summer solstice and bottoms out around the winter one.
  const phase = ((dayOfYear - 1) / daysInYear) * 2 * Math.PI;
  const solsticePhase = (172 / 365) * 2 * Math.PI;
  return (1 + Math.cos(phase - solsticePhase)) / 2;
}
