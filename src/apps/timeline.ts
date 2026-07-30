import type { WorldDate } from "../time/clock.js";
import { solarEvents } from "../time/sun.js";
import { ICON } from "./icons.js";

/**
 * Where everything sits along the timeline: one in-world day, midnight to midnight.
 *
 * Pure, and separate from the render function, because the placement is the part worth asserting.
 * The sunrise marker moving across the year is the whole reason the timeline is drawn from the solar
 * model rather than from fixed times, and a marker at the wrong fraction of the bar is a mistake
 * nothing else would catch — it looks plausible, and it lies about when the sun comes up.
 */

const MINUTES_PER_DAY = 1440;
const SECONDS_PER_DAY = 86_400;

/** The last minute of the day. Every gesture lands at or before it, so none can change the date. */
const LAST_MINUTE = MINUTES_PER_DAY - 1;

export type TimelineTarget = "midnight" | "sunrise" | "noon" | "sunset" | "endOfDay";

export interface TimelineMarker {
  target: TimelineTarget;
  /** Minutes past midnight this marker sets the clock to. */
  minutes: number;
  /** Where it sits along the bar, 0 to 100. */
  percent: number;
  /** The time printed underneath it. */
  label: string;
  icon: string;
  /**
   * Written out in full rather than built from `target`, so the translation scan can see it. An
   * interpolated key is invisible to that check and goes missing without anything failing.
   */
  tooltip: string;
}

export interface TimelineLayout {
  /** Where the current time sits along the bar, 0 to 100. */
  percent: number;
  markers: TimelineMarker[];
}

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/** `HH:MM` from minutes past midnight. */
export function timeLabel(minutes: number): string {
  const total = Math.round(minutes);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function marker(target: TimelineTarget, minutes: number, icon: string, tooltip: string): TimelineMarker {
  const clamped = Math.min(LAST_MINUTE, Math.max(0, minutes));
  return {
    target,
    minutes: clamped,
    percent: clampPercent((clamped / MINUTES_PER_DAY) * 100),
    label: timeLabel(clamped),
    icon,
    tooltip,
  };
}

/** Minutes past midnight at a fraction along the bar, clamped into the day. */
export function minutesAt(fraction: number): number {
  return Math.min(LAST_MINUTE, Math.round(Math.min(1, Math.max(0, fraction)) * MINUTES_PER_DAY));
}

export function timelineLayout(date: WorldDate, latitudeDeg: number): TimelineLayout {
  const events = solarEvents(date.dayOfYear, latitudeDeg);

  return {
    percent: clampPercent((date.secondsIntoDay / SECONDS_PER_DAY) * 100),
    markers: [
      marker("midnight", 0, ICON.midnight, "KRONOS.Action.Midnight"),
      marker("sunrise", events.sunrise, ICON.sunrise, "KRONOS.Action.Sunrise"),
      marker("noon", events.noon, ICON.noon, "KRONOS.Action.Noon"),
      marker("sunset", events.sunset, ICON.sunset, "KRONOS.Action.Sunset"),
      // Labelled 24:00 and set to 23:59, which is what the design does: the end of the day a GM can
      // reach without the gesture rolling over into the next one.
      {
        ...marker("endOfDay", LAST_MINUTE, ICON.endOfDay, "KRONOS.Action.EndOfDay"),
        percent: 100,
        label: "24:00",
      },
    ],
  };
}
