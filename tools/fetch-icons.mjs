#!/usr/bin/env node
/**
 * Rebuilds the bundled icon font from `src/apps/icons.json`.
 *
 * Run by hand when an icon is added or removed, never from the build: a network call in the release
 * path would make an offline build fail, and the point of bundling the font is that the module needs
 * no network at all. The result is committed.
 *
 * Google's stylesheet endpoint subsets by character, which is what keeps this to a couple of
 * kilobytes for the handful of symbols the panel draws. It only serves woff2 to a request that looks
 * like a browser, so the user agent below is load-bearing.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";

const SOURCE = "src/apps/icons.json";
const OUTPUT = "styles/fonts/kronos-symbols.woff2";

/**
 * The upstream name-to-codepoint table for the same font the subset is cut from.
 *
 * Checking against it is the only guard that catches a codepoint no glyph lives at: the stylesheet
 * endpoint echoes back whatever range was asked for, so a made-up codepoint comes back
 * "covered" and produces a subset that silently draws a missing-glyph box.
 */
const UPSTREAM_CODEPOINTS =
  "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function fail(message) {
  console.error(`fetch-icons: ${message}`);
  process.exit(1);
}

async function fetchAs(url, kind) {
  const response = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!response.ok) fail(`${kind} request failed with HTTP ${response.status}`);
  return kind === "font" ? Buffer.from(await response.arrayBuffer()) : await response.text();
}

/** `U+e034, U+e5cb-e5cc` into the set of codepoints it covers. */
function coveredCodepoints(css) {
  const declared = css.match(/unicode-range:\s*([^;]+);/)?.[1];
  if (!declared) fail("the returned stylesheet declares no unicode-range");

  const covered = new Set();
  for (const part of declared.split(",")) {
    const [from, to] = part.trim().replace(/^U\+/i, "").split("-");
    const start = Number.parseInt(from, 16);
    const end = to === undefined ? start : Number.parseInt(to, 16);
    for (let value = start; value <= end; value += 1) covered.add(value);
  }
  return covered;
}

const codepoints = JSON.parse(await readFile(SOURCE, "utf8"));

const wanted = Object.entries(codepoints).map(([name, hex]) => {
  if (typeof hex !== "string" || !/^[0-9a-f]{4}$/.test(hex)) {
    fail(`"${name}" is not a four-digit lowercase codepoint: ${JSON.stringify(hex)}`);
  }
  return { name, value: Number.parseInt(hex, 16) };
});

if (wanted.length === 0) fail(`${SOURCE} lists no icons`);

const upstream = new Map(
  (await fetchAs(UPSTREAM_CODEPOINTS, "codepoints"))
    .split("\n")
    .map((line) => line.trim().split(" "))
    .filter((parts) => parts.length === 2)
    .map(([name, hex]) => [name, hex]),
);
if (upstream.size === 0) fail("the upstream codepoints table came back empty");

const wrong = wanted.filter(({ name }) => upstream.get(name) !== codepoints[name]);
if (wrong.length > 0) {
  fail(
    `these do not match the upstream table: ${wrong
      .map(({ name }) => `${name} is U+${upstream.get(name) ?? "absent"}, not U+${codepoints[name]}`)
      .join("; ")}`,
  );
}

const text = wanted.map((icon) => String.fromCodePoint(icon.value)).join("");
const stylesheet = await fetchAs(
  `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&text=${encodeURIComponent(text)}`,
  "stylesheet",
);

// Secondary, and weaker: it only confirms the subset was cut to the range that was asked for.
const covered = coveredCodepoints(stylesheet);
const absent = wanted.filter((icon) => !covered.has(icon.value));
if (absent.length > 0) {
  fail(`the subset does not cover: ${absent.map((icon) => `${icon.name} (U+${icon.value.toString(16)})`).join(", ")}`);
}

const fontUrl = stylesheet.match(/url\((https:\/\/[^)]+)\)/)?.[1];
if (!fontUrl) fail("the returned stylesheet contains no font URL");

const font = await fetchAs(fontUrl, "font");
if (font.length === 0) fail("the downloaded font is empty");

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, font);

console.log(`fetch-icons: ${OUTPUT} written (${wanted.length} symbols, ${font.length} bytes)`);
