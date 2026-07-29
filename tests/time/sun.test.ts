import { describe, expect, it } from "vitest";

import { parseCalendar } from "../../src/time/calendar.js";
import { DEFAULT_SEASON_BOUNDARIES, seasonOf, type SeasonBoundary, summerness } from "../../src/time/season.js";
import { daylightMinutes, declination, solarEvents } from "../../src/time/sun.js";

/** Central Europe, the default the module ships with. */
const EUROPE_LAT = 48;

const MARCH_EQUINOX = 81;
const SUMMER_SOLSTICE = 172;
const SEPT_EQUINOX = 264;
const WINTER_SOLSTICE = 355;

const hhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;

describe("declination", () => {
  it("is zero at the March equinox and swings a full axial tilt either way", () => {
    expect(declination(MARCH_EQUINOX)).toBeCloseTo(0, 6);
    expect(declination(SUMMER_SOLSTICE)).toBeCloseTo(23.44, 1);
    expect(declination(WINTER_SOLSTICE)).toBeCloseTo(-23.44, 1);
  });
});

describe("solarEvents at 48°N", () => {
  it("gives an even twelve hours at the equinoxes", () => {
    const march = solarEvents(MARCH_EQUINOX, EUROPE_LAT);
    expect(hhmm(march.sunrise)).toBe("06:00");
    expect(hhmm(march.sunset)).toBe("18:00");

    const september = solarEvents(SEPT_EQUINOX, EUROPE_LAT);
    expect(hhmm(september.sunrise)).toBe("06:01");
    expect(hhmm(september.sunset)).toBe("17:59");
  });

  it("gives a long midsummer day", () => {
    const midsummer = solarEvents(SUMMER_SOLSTICE, EUROPE_LAT);
    expect(hhmm(midsummer.sunrise)).toBe("04:05");
    expect(hhmm(midsummer.sunset)).toBe("19:55");
  });

  it("gives a short midwinter day", () => {
    const midwinter = solarEvents(WINTER_SOLSTICE, EUROPE_LAT);
    expect(hhmm(midwinter.sunrise)).toBe("07:55");
    expect(hhmm(midwinter.sunset)).toBe("16:05");
  });

  it("keeps sunrise before noon before sunset all year", () => {
    for (let day = 1; day <= 365; day++) {
      const { sunrise, noon, sunset } = solarEvents(day, EUROPE_LAT);
      expect(sunrise).toBeLessThan(noon);
      expect(noon).toBeLessThan(sunset);
    }
  });

  it("swings daylight by roughly eight hours across the year", () => {
    const longest = daylightMinutes(SUMMER_SOLSTICE, EUROPE_LAT);
    const shortest = daylightMinutes(WINTER_SOLSTICE, EUROPE_LAT);
    expect((longest - shortest) / 60).toBeGreaterThan(7);
    expect((longest - shortest) / 60).toBeLessThan(9);
  });
});

describe("solarEvents at extreme latitudes", () => {
  it("reports midnight sun and polar night at 80°N", () => {
    expect(solarEvents(SUMMER_SOLSTICE, 80).polar).toBe("day");
    expect(solarEvents(WINTER_SOLSTICE, 80).polar).toBe("night");
  });

  it("still returns usable numbers when the sun never rises", () => {
    const night = solarEvents(WINTER_SOLSTICE, 80);
    expect(Number.isFinite(night.sunrise)).toBe(true);
    expect(night.sunset).toBe(night.sunrise);
  });

  it("holds a constant twelve hours at the equator", () => {
    expect(hhmm(solarEvents(SUMMER_SOLSTICE, 0).sunrise)).toBe("06:00");
    expect(hhmm(solarEvents(WINTER_SOLSTICE, 0).sunrise)).toBe("06:00");
  });
});

describe("seasonOf", () => {
  const gregorian = (month: number, day: number): string => seasonOf(month, day, DEFAULT_SEASON_BOUNDARIES);

  it("places each season between its boundaries", () => {
    expect(gregorian(1, 15)).toBe("winter");
    expect(gregorian(4, 10)).toBe("spring");
    expect(gregorian(7, 30)).toBe("summer");
    expect(gregorian(10, 5)).toBe("autumn");
    expect(gregorian(12, 25)).toBe("winter");
  });

  it("switches on the boundary day itself, not the day after", () => {
    expect(gregorian(3, 19)).toBe("winter");
    expect(gregorian(3, 20)).toBe("spring");
    expect(gregorian(6, 20)).toBe("spring");
    expect(gregorian(6, 21)).toBe("summer");
    expect(gregorian(9, 21)).toBe("summer");
    expect(gregorian(9, 22)).toBe("autumn");
    expect(gregorian(12, 20)).toBe("autumn");
    expect(gregorian(12, 21)).toBe("winter");
  });

  it("covers every day of the year", () => {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 28; day++) {
        expect(["winter", "spring", "summer", "autumn"]).toContain(gregorian(month, day));
      }
    }
  });

  // A calendar states its own boundaries, and the year does not have to begin in winter.
  describe("with boundaries of the calendar's own", () => {
    const onTheTwentieth: SeasonBoundary[] = [
      { month: 3, day: 20, season: "spring" },
      { month: 6, day: 20, season: "summer" },
      { month: 9, day: 20, season: "autumn" },
      { month: 12, day: 20, season: "winter" },
    ];

    it("switches on the days the calendar names, not the Gregorian ones", () => {
      expect(seasonOf(6, 20, onTheTwentieth)).toBe("summer");
      expect(seasonOf(6, 20, DEFAULT_SEASON_BOUNDARIES)).toBe("spring");
    });

    it("carries the last season of the year into the start of the next one", () => {
      expect(seasonOf(1, 1, onTheTwentieth)).toBe("winter");
      expect(seasonOf(3, 19, onTheTwentieth)).toBe("winter");
    });

    it("does not assume the year opens in winter", () => {
      const summerFirst: SeasonBoundary[] = [
        { month: 4, day: 1, season: "autumn" },
        { month: 7, day: 1, season: "winter" },
        { month: 10, day: 1, season: "spring" },
      ];
      // Nothing precedes April, and the wheel ended the previous year in spring.
      expect(seasonOf(1, 1, summerFirst)).toBe("spring");
      expect(seasonOf(4, 1, summerFirst)).toBe("autumn");
    });

    it("reads boundaries listed out of order, because parsing sorts them", () => {
      const shuffled = parseCalendar({
        name: "Shuffled",
        era: "X",
        yearOffset: 0,
        months: DEFAULT_SEASON_BOUNDARIES.map((_, index) => `Month${index + 1}`).concat(
          Array.from({ length: 8 }, (_, index) => `Extra${index + 1}`),
        ),
        weekdays: ["a", "b", "c", "d", "e", "f", "g"],
        seasons: [...onTheTwentieth].reverse(),
      });
      expect(seasonOf(6, 20, shuffled!.seasons)).toBe("summer");
    });
  });
});

describe("summerness", () => {
  it("peaks near the summer solstice and bottoms out near the winter one", () => {
    expect(summerness(SUMMER_SOLSTICE, 365)).toBeGreaterThan(0.98);
    expect(summerness(WINTER_SOLSTICE, 365)).toBeLessThan(0.05);
  });

  it("stays within its range every day of the year", () => {
    for (let day = 1; day <= 366; day++) {
      const value = summerness(day, 366);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
