import { getCalendar } from "../time/calendar.js";
import { monthShape, type WorldDate } from "../time/clock.js";

/**
 * A month laid out for a grid: the columns it has, how many cells precede day 1, and the days.
 *
 * Pure and separate from the render function for the same reason the timeline's geometry is — the part
 * worth asserting is the placement. `blanks` is that part. The design reference prints weekday headers
 * and then lists days from the first column regardless of which weekday day 1 falls on, which makes its
 * columns decorative; the number below is what stops us shipping the same thing.
 */

export interface MonthDay {
  day: number;
  /** The day the clock is on, and only when the month on screen is the one it is in. */
  isToday: boolean;
  isSelected: boolean;
}

export interface MonthView {
  /** Displayed year and month, after the requested month was wrapped into its year. */
  year: number;
  month: number;
  monthName: string;
  /** The grid's columns, in order. Any number of them is legal. */
  weekdays: readonly string[];
  /** Empty cells before day 1, so that it sits under its own weekday. */
  blanks: number;
  days: MonthDay[];
  /** The selection, after dropping one this month has no room for. */
  selected: number | null;
}

/**
 * @param selected a day number from an earlier view, or null. Dropped rather than clamped when this
 * month is too short for it: a clamped selection quietly means a different day than the one clicked.
 */
export function monthView(year: number, month: number, today: WorldDate, selected: number | null): MonthView {
  const calendar = getCalendar();
  const shape = monthShape(year, month);

  const showsToday = today.year === shape.year && today.month === shape.month;
  const keptSelection = selected !== null && selected >= 1 && selected <= shape.days ? selected : null;

  return {
    year: shape.year,
    month: shape.month,
    monthName: calendar.months[shape.month - 1] ?? String(shape.month),
    weekdays: calendar.weekdays,
    blanks: shape.firstWeekdayIndex,
    selected: keptSelection,
    days: Array.from({ length: shape.days }, (_, index) => ({
      day: index + 1,
      isToday: showsToday && today.day === index + 1,
      isSelected: keptSelection === index + 1,
    })),
  };
}
