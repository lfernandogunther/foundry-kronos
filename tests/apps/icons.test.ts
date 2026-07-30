import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import codepoints from "../../src/apps/icons.json" with { type: "json" };
import { ICON, weatherIcon } from "../../src/apps/icons.js";
import { WEATHER_CONDITIONS } from "../../src/weather/generator.js";

const STYLESHEET = "styles/kronos.css";
const css = readFileSync(STYLESHEET, "utf8");

/** Where Material Symbols keeps its glyphs. Anything outside it is not a symbol codepoint. */
const PRIVATE_USE_START = 0xe000;
const PRIVATE_USE_END = 0xf8ff;

describe("the icon table", () => {
  it("gives every symbol a four-digit lowercase codepoint", () => {
    // The font is subset from exactly these values, so a malformed one produces a missing glyph in
    // an installed module rather than an error anywhere a developer would see it.
    for (const [name, hex] of Object.entries(codepoints)) {
      expect(hex, name).toMatch(/^[0-9a-f]{4}$/);
    }
  });

  it("keeps every codepoint inside the private-use area the font uses", () => {
    for (const [name, hex] of Object.entries(codepoints)) {
      const value = Number.parseInt(hex, 16);
      expect(value, name).toBeGreaterThanOrEqual(PRIVATE_USE_START);
      expect(value, name).toBeLessThanOrEqual(PRIVATE_USE_END);
    }
  });

  it("resolves every panel icon to a single character from the table", () => {
    const known = new Set(Object.values(codepoints).map((hex) => String.fromCodePoint(Number.parseInt(hex, 16))));

    expect(Object.keys(ICON).length).toBeGreaterThan(10);
    for (const [name, glyph] of Object.entries(ICON)) {
      expect([...glyph], name).toHaveLength(1);
      expect(known, name).toContain(glyph);
    }
  });

  it("has an icon for every weather condition, by day and by night", () => {
    const known = new Set(Object.values(codepoints).map((hex) => String.fromCodePoint(Number.parseInt(hex, 16))));

    for (const condition of WEATHER_CONDITIONS) {
      for (const daylight of [true, false]) {
        expect(known, `${condition} ${daylight ? "by day" : "by night"}`).toContain(weatherIcon(condition, daylight));
      }
    }
  });

  it("draws the conditions whose glyph carries a sun differently after dark", () => {
    // A sun, or a cloud with a sun behind it, cannot be shown at ten in the evening. Rain and snow
    // look the same at every hour, and swapping those would be noise.
    const nocturnal = ["clear", "cloudy"] as const;

    for (const condition of nocturnal) {
      expect(weatherIcon(condition, false), condition).not.toBe(weatherIcon(condition, true));
    }
    for (const condition of WEATHER_CONDITIONS.filter((c) => !(nocturnal as readonly string[]).includes(c))) {
      expect(weatherIcon(condition, false), condition).toBe(weatherIcon(condition, true));
    }
  });
});

describe("the bundled font", () => {
  it("is requested from the stylesheet by a path that exists", () => {
    // The failure this guards is silent: a renamed or moved font file leaves every control in the
    // panel drawing a missing-glyph box, with nothing in the console.
    const url = /@font-face\s*\{[^}]*url\(\s*["']?([^"')]+)["']?\s*\)/.exec(css)?.[1];
    expect(url, "the stylesheet declares no @font-face url").toBeDefined();

    const resolved = join(dirname(STYLESHEET), url!);
    expect(existsSync(resolved), `${resolved} does not exist`).toBe(true);
    expect(statSync(resolved).size).toBeGreaterThan(0);
  });

  it("is named for this module rather than for the font it is cut from", () => {
    // A subset registered as "Material Symbols Outlined" would shadow the real font for any other
    // module that loads it, leaving that module with only our twenty glyphs.
    const family = /@font-face\s*\{[^}]*font-family:\s*["']([^"']+)["']/.exec(css)?.[1];
    expect(family).toBe("Kronos Symbols");
  });

  it("is packaged from a folder the packaging step copies", () => {
    const statics = /const STATIC_PATHS = \[([^\]]+)\]/.exec(readFileSync("tools/package.mjs", "utf8"))?.[1];
    expect(statics, "cannot find STATIC_PATHS in tools/package.mjs").toBeDefined();

    const url = /@font-face\s*\{[^}]*url\(\s*["']?([^"')]+)["']?\s*\)/.exec(css)![1]!;
    const topLevel = join(dirname(STYLESHEET), url).split("/")[0];
    expect(statics).toContain(`"${topLevel}"`);
  });
});
