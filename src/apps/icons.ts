import codepoints from "./icons.json" with { type: "json" };
import type { WeatherCondition } from "../weather/generator.js";

/**
 * The panel's icons, as characters.
 *
 * The bundled font is a subset built from the codepoints in `icons.json`, and subsetting by
 * codepoint leaves no ligature table behind — so the symbols have to be addressed by their
 * private-use character rather than by writing their name and letting the font substitute it.
 * `icons.json` is what the subset is generated from, which makes it the one place a symbol is
 * named: an icon added here without regenerating the font shows up as a missing glyph rather
 * than as the wrong one.
 */

type SymbolName = keyof typeof codepoints;

const glyph = (name: SymbolName): string => String.fromCodePoint(Number.parseInt(codepoints[name], 16));

export const ICON = {
  midnight: glyph("bedtime"),
  sunrise: glyph("wb_twilight"),
  noon: glyph("wb_sunny"),
  sunset: glyph("wb_twilight"),
  endOfDay: glyph("dark_mode"),
  collapse: glyph("chevron_left"),
  expand: glyph("chevron_right"),
  run: glyph("play_arrow"),
  pause: glyph("pause"),
  stepBackMany: glyph("keyboard_double_arrow_left"),
  stepBackOne: glyph("chevron_left"),
  stepForwardOne: glyph("chevron_right"),
  stepForwardMany: glyph("keyboard_double_arrow_right"),
  settings: glyph("settings"),
  festival: glyph("celebration"),
} as const;

const CONDITION_SYMBOLS: Readonly<Record<WeatherCondition, SymbolName>> = {
  clear: "wb_sunny",
  cloudy: "partly_cloudy_day",
  overcast: "cloud",
  fog: "foggy",
  rain: "rainy",
  storm: "thunderstorm",
  // A snowflake rather than a snowing cloud: at the size the panel draws it, the cloud is
  // indistinguishable from the rain one.
  snow: "ac_unit",
  windy: "air",
};

/**
 * The two conditions whose glyph draws the sun, and so cannot be shown after dark.
 *
 * Rain and snow look the same at every hour; a sun, or a cloud with a sun behind it, does not — at
 * ten in the evening it is simply wrong.
 */
const NIGHT_SYMBOLS: Readonly<Partial<Record<WeatherCondition, SymbolName>>> = {
  clear: "bedtime",
  cloudy: "partly_cloudy_night",
};

/** The icon for a condition, given whether the sun is up. */
export function weatherIcon(condition: WeatherCondition, daylight: boolean): string {
  const night = daylight ? undefined : NIGHT_SYMBOLS[condition];
  return glyph(night ?? CONDITION_SYMBOLS[condition]);
}
