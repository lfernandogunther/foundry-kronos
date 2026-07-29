/**
 * Pure Gregorian date helpers, all in UTC.
 *
 * The PF2e World Clock does its arithmetic in Gregorian terms and only renames the months, so
 * matching its dates means doing Gregorian arithmetic too. Native `Date` covers this without a
 * date library, but its month arithmetic overflows (31 Jan + 1 month lands on 3 March), so month
 * and year steps clamp explicitly below.
 */

const MS_PER_DAY = 86_400_000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** @param month 1-12 */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** 1 on 1 January, 365 or 366 on 31 December. */
export function dayOfYear(ms: number): number {
  const d = new Date(ms);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - startOfYear) / MS_PER_DAY) + 1;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Add whole months, clamping the day to the target month's length rather than spilling over.
 * 31 January + 1 month is 28 (or 29) February, never 3 March.
 */
export function addMonthsUtc(ms: number, months: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();

  // Day 1 keeps the shift from overflowing while we work out how long the target month is.
  const target = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + months,
      1,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  );

  const limit = daysInMonth(target.getUTCFullYear(), target.getUTCMonth() + 1);
  target.setUTCDate(Math.min(day, limit));
  return target.getTime();
}

/** Years clamp for the same reason months do: 29 February + 1 year is 28 February. */
export function addYearsUtc(ms: number, years: number): number {
  return addMonthsUtc(ms, years * 12);
}
