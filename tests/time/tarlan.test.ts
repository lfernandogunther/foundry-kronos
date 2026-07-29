import { describe, expect, it } from "vitest";

import tarlanRaw from "../../data/calendars/tarlan.json" with { type: "json" };
import { type CalendarDefinition, daysInCalendarYear, parseCalendar } from "../../src/time/calendar.js";
import { dayOfYearOf } from "../../src/time/reckoning.js";
import { seasonOf } from "../../src/time/season.js";
import { daylightMinutes } from "../../src/time/sun.js";

const tarlan = parseCalendar(tarlanRaw) as CalendarDefinition;
const lengths = tarlan.monthDays!;

/** The latitude the module defaults to, central Europe. */
const LATITUDE = 48;

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
