export type Season = "winter" | "spring" | "summer" | "autumn";

const SEASONS: readonly Season[] = ["winter", "spring", "summer", "autumn"] as const;

export function isSeason(value: unknown): value is Season {
  return typeof value === "string" && (SEASONS as readonly string[]).includes(value);
}

/** Where a season starts, as the (month, day) it begins on. */
export interface SeasonBoundary {
  month: number;
  day: number;
  season: Season;
}

/**
 * Northern-hemisphere season boundaries for the Gregorian structure, used by any calendar that does
 * not state its own.
 *
 * Fixed dates rather than computed equinoxes: the real ones drift by a day either way, which no
 * one at the table will notice, and a fixed table is something a GM can reason about.
 */
export const DEFAULT_SEASON_BOUNDARIES: readonly SeasonBoundary[] = [
  { month: 3, day: 20, season: "spring" },
  { month: 6, day: 21, season: "summer" },
  { month: 9, day: 22, season: "autumn" },
  { month: 12, day: 21, season: "winter" },
];

/**
 * The season a date falls in, given the boundaries the calendar states.
 *
 * @param boundaries in chronological order, which parsing guarantees
 */
export function seasonOf(month: number, day: number, boundaries: readonly SeasonBoundary[]): Season {
  // Before the first boundary the wheel has not turned yet, so the season is still the one the
  // previous year ended in — whichever the last boundary names.
  let current: Season = boundaries.at(-1)?.season ?? "winter";
  for (const boundary of boundaries) {
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
