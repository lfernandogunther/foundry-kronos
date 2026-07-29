import { afterEach, describe, expect, it } from "vitest";

import tarlanRaw from "../../data/calendars/tarlan.json" with { type: "json" };
import { darknessAt } from "../../src/scene/darkness-curve.js";
import {
  BUNDLED_CALENDAR,
  bundledCalendar,
  type CalendarDefinition,
  daysInCalendarYear,
  parseCalendar,
  setCalendar,
} from "../../src/time/calendar.js";
import { dateKeyOf, getWorldDate, secondsUntilTimeOfDay } from "../../src/time/clock.js";
import { dayOfYearOf } from "../../src/time/reckoning.js";
import { seasonOf } from "../../src/time/season.js";
import { daylightMinutes, solarEvents } from "../../src/time/sun.js";
import { stepSeconds } from "../../src/time/units.js";

const tarlan = parseCalendar(tarlanRaw) as CalendarDefinition;
const lengths = tarlan.monthDays!;

/** The latitude the module defaults to, central Europe. */
const LATITUDE = 48;
const DAY = 86_400;

const doyOf = (month: number, day: number): number => dayOfYearOf(lengths, month, day);

describe("the Tarlan calendar", () => {
  it("parses", () => {
    expect(tarlan).not.toBeNull();
    expect(tarlan.era).toBe("TR");
  });

  it("has twelve months and seven weekdays", () => {
    expect(tarlan.months).toHaveLength(12);
    expect(tarlan.weekdays).toHaveLength(7);
    expect(tarlan.weekdays[0]).toBe("Verdrag");
  });

  it("runs 365 days, so the seasons fall on the same dates every year", () => {
    expect(daysInCalendarYear(tarlan)).toBe(365);
  });

  it("keeps every month between 30 and 31 days", () => {
    for (const [index, days] of lengths.entries()) {
      expect(days, `${tarlan.months[index]} has ${days} days`).toBeGreaterThanOrEqual(30);
      expect(days, `${tarlan.months[index]} has ${days} days`).toBeLessThanOrEqual(31);
    }
  });

  it("gives the three sacred months 31 days and a festival", () => {
    for (const name of ["Enudar", "Ellariel", "Zyullian"]) {
      const month = tarlan.months.indexOf(name) + 1;
      expect(month, `${name} is missing`).toBeGreaterThan(0);
      expect(lengths[month - 1], `${name} should be a long month`).toBe(31);
      expect(tarlan.festivals.some((festival) => festival.month === month)).toBe(true);
    }
  });

  it("names three festivals and no more", () => {
    expect(tarlan.festivals.map((festival) => festival.name)).toEqual([
      "Enudrani's Renewal",
      "Ellaryn's Vigil",
      "Z'yull's Reckoning",
    ]);
  });
});

/**
 * The month lengths were chosen so that the four turning points land on the twentieth, and the
 * twentieth is where the sun actually turns. Reshuffling a month's length breaks that alignment
 * silently — the bar would keep showing a season, just the wrong one — so it is asserted against the
 * solar model rather than against the numbers it was derived from.
 */
describe("Tarlan's seasons turn when the daylight does", () => {
  const boundaries = Object.fromEntries(tarlan.seasons.map((entry) => [entry.season, entry]));

  it("starts each season on the twentieth of its month", () => {
    for (const entry of tarlan.seasons) expect(entry.day).toBe(20);
    expect(tarlan.seasons.map((entry) => tarlan.months[entry.month - 1])).toEqual([
      "Zherial",
      "Arkhane",
      "Tierbrak",
      "Zyullian",
    ]);
  });

  /** The day of year a season actually opens on, as the calendar declares it. */
  const opensOn = (season: string): number => doyOf(boundaries[season]!.month, boundaries[season]!.day);

  it("opens spring and autumn on a day of near-equal light and dark", () => {
    for (const season of ["spring", "autumn"]) {
      const daylight = daylightMinutes(opensOn(season), LATITUDE);
      expect(Math.abs(daylight - 720), `${season} opens on ${daylight} minutes of daylight`).toBeLessThan(15);
    }
  });

  it("opens summer on the longest day and winter on the shortest", () => {
    let longest = 1;
    let shortest = 1;
    for (let day = 1; day <= 365; day += 1) {
      if (daylightMinutes(day, LATITUDE) > daylightMinutes(longest, LATITUDE)) longest = day;
      if (daylightMinutes(day, LATITUDE) < daylightMinutes(shortest, LATITUDE)) shortest = day;
    }
    expect(Math.abs(opensOn("summer") - longest)).toBeLessThanOrEqual(1);
    expect(Math.abs(opensOn("winter") - shortest)).toBeLessThanOrEqual(1);
  });

  it("gets dark hours earlier in winter than in summer", () => {
    const winter = daylightMinutes(opensOn("winter"), LATITUDE);
    const summer = daylightMinutes(opensOn("summer"), LATITUDE);
    // Sunset sits half the daylight arc after noon, so the gap between the two sunsets is half this.
    expect((summer - winter) / 2).toBeGreaterThan(3 * 60);
  });

  it("labels each month with the season its lore describes", () => {
    const seasonIn = (name: string, day: number): string =>
      seasonOf(tarlan.months.indexOf(name) + 1, day, tarlan.seasons);

    expect(seasonIn("Enudar", 1)).toBe("winter");
    expect(seasonIn("Krigvaldar", 25)).toBe("spring");
    expect(seasonIn("Ellariel", 15)).toBe("summer");
    expect(seasonIn("Elyndrel", 10)).toBe("autumn");
    expect(seasonIn("Zyullian", 31)).toBe("winter");
  });
});

/**
 * The calendar driving the module rather than the file on its own: what a GM would see on the bar,
 * and what the controls would do, with Tarlan selected in a world created at the Unix epoch.
 */
describe("Tarlan in force", () => {
  const shipped = bundledCalendar("tarlan");

  // tarlan.json anchors 2025-01-01T00:00:00Z to Enudar 1, 1000 TR.
  const ANCHOR = Date.UTC(2025, 0, 1) / 1000;
  const MONTH_STARTS = [0, 31, 61, 92, 122, 153, 183, 214, 244, 274, 304, 334];

  /** Pure: resolving a date must not itself change which calendar is in force. */
  const on = (month: number, day: number, hour = 0): number =>
    ANCHOR + (MONTH_STARTS[month - 1]! + day - 1) * DAY + hour * 3600;

  const hhmm = (minutes: number): string =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;

  afterEach(() => setCalendar(BUNDLED_CALENDAR));

  it("reads the date, era and season the bar will show", () => {
    setCalendar(shipped);
    const date = getWorldDate(on(12, 20));
    expect(`${String(date.day).padStart(2, "0")} ${date.monthName} ${date.year} ${date.era}`).toBe(
      "20 Zyullian 1000 TR",
    );
    expect(date.season).toBe("winter");
    expect(date.festival).toBe("Z'yull's Reckoning");
  });

  it("steps a whole year a day at a time without leaving 30-31 or skipping a day of the year", () => {
    setCalendar(shipped);
    let worldTime = on(1, 1);
    for (let index = 1; index <= 365; index += 1) {
      const date = getWorldDate(worldTime);
      expect(date.dayOfYear).toBe(index);
      expect(date.day).toBeLessThanOrEqual(lengths[date.month - 1]!);
      worldTime += stepSeconds("day", 1, worldTime);
    }
    expect(getWorldDate(worldTime)).toMatchObject({ year: 1001, month: 1, day: 1, dayOfYear: 1 });
  });

  it("clamps a month step out of a long month, keeping the hour", () => {
    setCalendar(shipped);
    const from = on(1, 31, 9);
    const moved = getWorldDate(from + stepSeconds("month", 1, from));
    expect(`${moved.day} ${moved.monthName} ${moved.hour}h`).toBe("30 Halveris 9h");
  });

  it("returns the same month and day a year on", () => {
    setCalendar(shipped);
    const from = on(7, 15);
    const moved = getWorldDate(from + stepSeconds("year", 1, from));
    expect(`${moved.day} ${moved.monthName} ${moved.year}`).toBe("15 Ellariel 1001");
  });

  it("advances the weekday one step a day, in the order the calendar declares", () => {
    setCalendar(shipped);
    const names = Array.from({ length: 400 }, (_, index) => getWorldDate(on(1, 1) + index * DAY).weekdayName);
    expect(new Set(names).size).toBe(7);
    for (let index = 1; index < names.length; index += 1) {
      const previous = shipped.weekdays.indexOf(names[index - 1]!);
      expect(names[index]).toBe(shipped.weekdays[(previous + 1) % 7]);
    }
    // The anchor keeps the real weekday, so the phase follows from it: 1 January 2025 was a Wednesday.
    expect(names[0]).toBe("Thalorin");
  });

  it("turns the season on the twentieth and not the day before", () => {
    setCalendar(shipped);
    for (const [month, season] of [[3, "spring"], [6, "summer"], [9, "autumn"], [12, "winter"]] as const) {
      expect(getWorldDate(on(month, 20)).season).toBe(season);
      expect(getWorldDate(on(month, 19)).season).not.toBe(season);
    }
  });

  it("darkens the evening hours earlier in Zyullian than in Arkhane", () => {
    setCalendar(shipped);
    const midwinter = getWorldDate(on(12, 20)).dayOfYear;
    const midsummer = getWorldDate(on(6, 20)).dayOfYear;

    expect(hhmm(solarEvents(midwinter, LATITUDE).sunset)).toBe("16:05");
    expect(hhmm(solarEvents(midsummer, LATITUDE).sunset)).toBe("19:55");

    // Six in the evening is night in midwinter and broad day in midsummer.
    expect(darknessAt(18 * 60, midwinter, LATITUDE)).toBeGreaterThan(0.9);
    expect(darknessAt(18 * 60, midsummer, LATITUDE)).toBeLessThan(0.1);
  });

  it("names each festival on its day and no other", () => {
    setCalendar(shipped);
    expect(getWorldDate(on(1, 1)).festival).toBe("Enudrani's Renewal");
    expect(getWorldDate(on(7, 15)).festival).toBe("Ellaryn's Vigil");
    expect(getWorldDate(on(1, 2)).festival).toBeNull();
    expect(getWorldDate(on(7, 16)).festival).toBeNull();
  });

  it("changes the names and the year but not the clock, when a world switches to it", () => {
    const instant = Date.UTC(2025, 3, 14, 21, 30) / 1000;

    const golarion = getWorldDate(instant);
    setCalendar(shipped);
    const tarlanDate = getWorldDate(instant);

    expect([tarlanDate.hour, tarlanDate.minute, tarlanDate.weekdayIndex]).toEqual([
      golarion.hour,
      golarion.minute,
      golarion.weekdayIndex,
    ]);
    expect(golarion.monthName).toBe("Gozran");
    expect(tarlanDate.monthName).not.toBe("Gozran");
  });

  it("jumps to a time of day off its own day", () => {
    setCalendar(shipped);
    const evening = on(6, 20, 21);
    const delta = secondsUntilTimeOfDay(evening, 12 * 60);
    expect(delta).toBeGreaterThan(0);
    expect(getWorldDate(evening + delta).hour).toBe(12);
  });

  it("keys its weather under its own name, so no override leaks between calendars", () => {
    setCalendar(shipped);
    const tarlanKey = dateKeyOf(getWorldDate(on(1, 1)));
    expect(tarlanKey).toBe("Tarlan:1000-01-01");

    setCalendar(BUNDLED_CALENDAR);
    expect(dateKeyOf(getWorldDate(on(1, 1)))).not.toBe(tarlanKey);
  });
});

describe("Golarion is left as it was", () => {
  it("keeps Gregorian month lengths and leap years", () => {
    setCalendar(BUNDLED_CALENDAR);
    expect(stepSeconds("month", 1, Date.UTC(2024, 1, 1) / 1000)).toBe(29 * DAY);
    expect(getWorldDate(Date.UTC(2024, 1, 29) / 1000)).toMatchObject({ month: 2, day: 29, monthName: "Calistril" });
  });
});
