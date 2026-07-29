import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "../lang/en.json" with { type: "json" };
import { SEASON_ICONS } from "../src/time/season.js";
import { STEP_UNITS } from "../src/time/units.js";
import { WEATHER_CONDITIONS } from "../src/weather/generator.js";

const PREFIX = "PF2ECALENDARBAR";
const known = new Set(Object.keys(en));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

/** Keys written out in full. Interpolated ones are covered by the enumerations below. */
function staticKeys(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of sourceFiles("src")) {
    const contents = readFileSync(file, "utf8");
    for (const match of contents.matchAll(new RegExp(`["'\`](${PREFIX}\\.[A-Za-z0-9_.-]+)["'\`]`, "g"))) {
      const key = match[1];
      if (key) found.set(key, file);
    }
  }
  return found;
}

describe("translation keys", () => {
  it("finds keys in the source to check", () => {
    // Guards the scan itself: a regex that matched nothing would make every test below vacuous.
    expect(staticKeys().size).toBeGreaterThan(10);
  });

  it("has a translation for every key written out in the source", () => {
    const missing = [...staticKeys()].filter(([key]) => !known.has(key)).map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });

  it("has a translation for every season", () => {
    for (const season of Object.keys(SEASON_ICONS)) {
      expect(known).toContain(`${PREFIX}.Season.${season}`);
    }
  });

  it("has a translation for every weather condition", () => {
    for (const condition of WEATHER_CONDITIONS) {
      expect(known).toContain(`${PREFIX}.Weather.${condition}`);
      expect(known).toContain(`${PREFIX}.Mapping.NoEffect`);
    }
  });

  it("has a translation for every step unit", () => {
    for (const unit of STEP_UNITS) {
      expect(known).toContain(`${PREFIX}.Unit.${unit}`);
    }
  });

  it("has a translation for every reason the clock can be stopped", () => {
    // These come from haltReason(); "paused" is the ordinary state and has its own label.
    for (const reason of ["no-active-gm", "game-paused", "combat"]) {
      expect(known).toContain(`${PREFIX}.Clock.Halted.${reason}`);
    }
  });

  it("has no translations that nothing uses", () => {
    const used = new Set(staticKeys().keys());
    for (const season of Object.keys(SEASON_ICONS)) used.add(`${PREFIX}.Season.${season}`);
    for (const condition of WEATHER_CONDITIONS) used.add(`${PREFIX}.Weather.${condition}`);
    for (const unit of STEP_UNITS) used.add(`${PREFIX}.Unit.${unit}`);
    for (const reason of ["no-active-gm", "game-paused", "combat"]) used.add(`${PREFIX}.Clock.Halted.${reason}`);
    used.add(`${PREFIX}.ModuleTitle`);

    expect([...known].filter((key) => !used.has(key))).toEqual([]);
  });
});
