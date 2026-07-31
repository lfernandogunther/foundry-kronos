# Kronos

A floating panel for Foundry VTT v14 showing the in-world season, date, time, weather and
temperature, with GM controls for moving time. Built for the Pathfinder 2e system.

```
                                                              ┌───┐
 ┌────────────────────────────────────────────────────────────┤ ‹ │
 │   🌙            🌅          ☀              🌇         🌗   └───┤
 │   ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁●▁▁▁▁▁▁▁▁▁▁    │
 │  00:00         07:53      12:00           16:07      24:00   │
 │                                                              │
 │ ┌──────────┬─────────────────┬───────────┬─────────────────┐ │
 │ │  22:00   │ OATHDAY         │ 🌙 -8°C   │ ⏸ ⏪ ◀ [unit▾]  │ │
 │ │  00s     │ 08 Kuthona      │    Clear  │      ▶ ⏩  │ ⚙   │ │
 │ │          │ (4725) · WINTER │           │                 │ │
 │ └──────────┴─────────────────┴───────────┴─────────────────┘ │
 └──────────────────────────────────────────────────────────────┘
```

The timeline is one in-world day. Players see it and the readouts; the marker buttons, the handle and
the control panel are GM-only. The tab on the right border collapses the panel to a narrow strip, per
client. Drag the panel by its background to move it, and it stays where you put it.

## Installing

In Foundry: *Add-on Modules* → *Install Module*, and paste this into **Manifest URL**:

```
https://github.com/lfernandogunther/foundry-kronos/releases/latest/download/module.json
```

That is the normal way to install it, on any machine, with no checkout and no build. Foundry re-reads
that URL to spot new versions, so *Manage Modules* offers updates from then on.

It resolves to whatever the newest release is. There is nothing there until the first tag is pushed —
see [Releasing](#releasing).

## Installing from a checkout

The build produces a self-contained module folder at `dist/foundry-kronos/` — `module.json`
beside `scripts/`, `styles/`, `lang/` and `data/`, and nothing else. That folder is what Foundry
installs; sources, tests and `node_modules` stay out of it.

```bash
npm install
npm run install:foundry
```

That builds and copies it into your Foundry modules folder. If it cannot find one, give it the
*User Data Path* from Foundry's setup screen:

```bash
FOUNDRY_DATA="$HOME/Library/Application Support/FoundryVTT" npm run install:foundry
```

It refuses to overwrite a directory that is not a previous install of this module, so a mistyped
path cannot eat another module.

Restart Foundry, then enable **Kronos** in *Manage Modules*.

To install by hand instead — onto another machine, or a server you only have file access to — run
`npm run build` and copy `dist/foundry-kronos/` into `<FOUNDRY_DATA>/Data/modules/`.

While working on it, `npm run dev` rebuilds the script on save. Note it does **not** re-copy the
static files or re-install; run `npm run install:foundry` after changing `module.json`, `lang/`,
`styles/` or `data/`.

For your own machine this is the better loop — no tagging, no waiting on CI. The manifest URL is for
everyone else, and for update prompts.

## Releasing

A release is what the manifest URL points at. Pushing a tag builds, checks, zips and publishes one:

```bash
npm version 0.2.0 --no-git-tag-version   # package.json
# then set the same version in module.json, and the version in its `download` URL
git commit -am "chore: release 0.2.0"
git tag v0.2.0
git push origin main --tags
```

Three places carry the version and all three must agree — the tests fail if they do not, and the
release step refuses a tag that disagrees with the manifest. That is deliberate: a manifest whose
`download` still names the previous tag publishes a release that installs the previous code.

`npm run release` builds the same `dist/foundry-kronos.zip` locally if you want to look inside it
before tagging. `module.json` sits at the archive root, which is where Foundry looks for it.

## Modules that conflict

Anything else that advances world time on its own will compound with this module's real-time clock:
**Simple Calendar**, **about-time** and **chronos** all do. Run one timekeeper at a time.

## How it keeps time

World time is never stored by this module. Everything on the bar is derived from
`game.time.worldTime`, and every control calls `game.time.advance()`.

There are two ways a date gets built, and the calendar in force decides which.

**Golarion** is reconstructed with the same formula PF2e's own World Clock uses — world creation
timestamp plus `worldTime` seconds, read in UTC, with the Absalom Reckoning year offset applied — so
the two never disagree. At startup the module compares itself against the system clock and logs a
warning if they drift. Because that clock is Gregorian underneath, months have Gregorian lengths and
Gregorian leap years rather than canon Golarion's eight-year rule.

**A calendar with months of its own** counts days from its own anchor instead, which is what lets it
have months no Gregorian year contains. It gives up agreement with the PF2e World Clock to do that —
the two will show different dates for the same moment, and nothing can reconcile them. The startup
log says which calendar is in force and, when it is one of these, that the system clock will differ.
Pick one as the calendar of record.

Either way `worldTime` itself is untouched, so switching calendars in a running world relabels the
same instant rather than moving it.

## Controls

| Control | Does |
| --- | --- |
| the timeline | Click anywhere on it, or drag the handle, to set the time of day |
| `🌙` `🌅` `☀` `🌇` `🌗` | Set the clock to midnight, sunrise, noon, sunset or the end of the day |
| `⏸` / `▶` | Stops or starts **time only** — the game keeps running |
| `⏪` `◀` `▶` `⏩` | Move by the selected unit; outer arrows move the configured multiple |
| unit select | second, round (6s), minute, hour, day, month, year |
| condition / temperature | GM click opens the weather override |
| `⚙` | Opens the module settings |
| the tab on the border | Collapses and expands the panel, remembered per client |

Everything on the timeline works **inside the day it is already**, and may therefore move time
backwards: dragging the handle left moves the clock left, and asking for sunrise at ten at night
rewinds to that morning rather than advancing to the next one. That is what a bar spanning a single
day has to mean — the alternative turns a small drag backwards into a jump of nearly a full day. The
step arrows are unaffected and still move in whichever direction they point.

Sunrise and sunset shift across the year from a configurable latitude, defaulting to central
Europe, and the two markers move along the bar with them. PF2e's own World Clock uses fixed dawn and
dusk times, so its jumps land elsewhere.

Collapsing the panel hides the timeline, so it hides the solar markers with it, along with the season
tag, the weather and the outer step arrows. The time, the date, the inner arrows and the unit select
stay.

## The real-time clock

While running, world time advances on its own. Only the active GM runs the interval, so two
connected GMs do not double the rate and a disconnected one stops it. There is no catch-up: on
reconnect the clock resumes where it stopped rather than jumping forward by the elapsed real time.

Ticks are coarse by default — 10 real seconds — because each one is a world write broadcast to
every client that re-triggers darkness sync and every module's `updateWorldTime` handler.

## Weather

Generated per in-world day and seeded from the date, so every client derives the same weather
without anything being stored or broadcast. A GM override is the only part that is persisted.

With *Apply weather to scenes* enabled, the condition drives Foundry's scene weather. It never
overwrites weather set by hand, and scenes can opt out individually in their configuration. The
condition-to-effect mapping is built from whatever is registered in `CONFIG.weatherEffects`, so
ambiences added by other modules are available as targets.

## Calendars

The *Calendar* setting picks between the ones that ship with the module:

| Calendar | Months | Agrees with the PF2e World Clock |
| --- | --- | --- |
| Golarion — Absalom Reckoning | Gregorian lengths, leap years | Yes |
| Tarlan | Twelve of its own, 30 or 31 days, 365-day year | No |

### Tarlan

A homebrew reckoning where no month is shorter than 30 days or longer than 31, so the seasons fall on
the same dates every year. Twelve months named for the gods, and seven weekdays:
**Verdrag · Eldora · Thalorin · Drusten · Mithralis · Sylvain · Solara**.

| # | Month | Days | # | Month | Days |
| --- | --- | --- | --- | --- | --- |
| 1 | **Enudar** | 31 | 7 | **Ellariel** | 31 |
| 2 | Halveris | 30 | 8 | Lornathis | 30 |
| 3 | Zherial | 31 | 9 | Tierbrak | 30 |
| 4 | Fideril | 30 | 10 | Elyndrel | 30 |
| 5 | Krigvaldar | 31 | 11 | Sovinaris | 30 |
| 6 | Arkhane | 30 | 12 | **Zyullian** | 31 |

The seasons turn on the **twentieth** of Zherial, Arkhane, Tierbrak and Zyullian — and the month
lengths were chosen to put those four days on the equinoxes and solstices the solar model actually
computes. At the default latitude the sun sets around 16:05 on Zyullian 20 and around 19:55 on
Arkhane 20, so midwinter evenings darken hours earlier than midsummer ones without anything being
configured. A test asserts that alignment against the solar model, so reshuffling a month's length
cannot quietly break it.

Enudar, Ellariel and Zyullian are the months of Enudrani, Ellaryn and Z'yull. They are long months,
and each carries a festival the bar names on the day: *Enudrani's Renewal* on Enudar 1, *Ellaryn's
Vigil* on Ellariel 15, and *Z'yull's Reckoning* on Zyullian 20 — the winter solstice, the longest
night of the year.

Its year is 365 days with no leap rule. That is the price of the 30-to-31 range: a leap day would
need a 32-day month, or a day belonging to no month at all.

### Anchoring a calendar to your world

A calendar with months of its own has to be told which instant its reckoning starts from, and it is
declared in Gregorian terms because that is what you can read off the bar:

```json
"epoch": { "on": "2025-04-14T21:30:00Z", "year": 1000, "month": 1, "day": 1 }
```

That reads as *the moment the bar showed 14 April 2025, 21:30 is Enudar 1 of 1000 TR*. Absalom
Reckoning years are Gregorian plus 2700 and the month and day are identical, so a bar reading
`14 Gozran 4725 AR` is `2025-04-14`. The instant's hour and weekday carry across, so switching a
running world to it changes the names and the year — not the time on the clock, and not the day of
the week.

Tarlan ships anchored at `2025-01-01T00:00:00Z`; edit `epoch.on` in
`data/calendars/tarlan.json` to put your own campaign's date there.

### Writing your own

Point the *Calendar file* setting at a JSON file and it overrides the choice above. Copy either
bundled file from `data/calendars/` as a starting point.

`months` accepts two shapes, and which one you use decides the structure:

```json
"months": ["Abadius", "Calistril", "..."]                      // Gregorian lengths, PF2e-synced
"months": [{ "name": "Enudar", "days": 31 }, "..."]            // lengths of its own
```

Bare names keep the Gregorian structure, so a calendar file written for an earlier version still
means what it meant. State day counts and the calendar owns its year — any number of months, any
number of weekdays, and `seasons`, `festivals` and `epoch` are yours to place. `seasons` and
`festivals` are optional; omitting `seasons` inherits the northern-hemisphere Gregorian boundaries.

A malformed file is rejected in favour of the calendar already in force, and the console says which
field was wrong.

## Development

```bash
npm run typecheck
npm run test
npm run check     # all of the above plus the build
npm run harness   # the panel in a browser, no Foundry needed
```

### Working on the panel without a Foundry

`npm run harness` serves the real panel — the actual code in `src/`, the actual `styles/kronos.css`,
the actual icon font — against stubbed Foundry globals, and reloads on save. It mounts through the
same `_renderHTML` and `_onRender` the application calls, so gestures work: you can drag the handle
and watch what it writes.

Query parameters put it in states a world is not currently in:

| | |
| --- | --- |
| `?player=1` | What a non-GM sees |
| `?compact=1` | Collapsed |
| `?weather=0` | Weather switched off |
| `?calendar=tarlan` | Another bundled calendar |
| `?date=2025-06-21T14:30` | Any date; `?at=79200` takes a raw world time |
| `?condition=storm` | Force a weather condition, to see every icon |
| `?gallery=1` | Every state above at once, for eyeballing a change |

**What it cannot tell you.** Anything that only a running Foundry provides is absent and cannot be
mocked honestly — the `DialogV2` frame, the settings sheet the gear opens, hooks firing,
`updateWorldTime` between clients, writes to Scene documents, and agreement with the PF2e World Clock.
Stubbing those would assert a guess against itself: it passes and proves nothing.

For those, the community's answer is [Quench](https://github.com/Ethaks/FVTT-Quench) — Mocha and Chai
running inside a live world as a test-runner application. It needs a Foundry, and so does the other
common setup (a real instance in Docker driven by Cypress or Playwright). A licence is required to
*download* Foundry, not only to run it, so there is no free instance to point either of them at.

The one place that gap shaped the code is the override dialog: its styling is gated on Foundry's frame
actually being present, so an unconfirmed class name leaves you with Foundry's own dialog rather than
this module's card wrapped around it. `tests/styles.test.ts` holds that line.

### The panel's icons

The panel draws its icons from a twenty-glyph subset of Material Symbols Outlined, committed at
`styles/fonts/kronos-symbols.woff2` — about 2 KB. It is bundled rather than fetched, because a world
with no internet, or a locked-down one, would otherwise show no icons at all. The family is
registered as `Kronos Symbols` so a subset this small cannot shadow the real font for another module.

`src/apps/icons.json` maps each symbol's name to its codepoint and is the single source: the panel
imports it, and the font is generated from it. Adding an icon means adding a line there and running

```bash
node tools/fetch-icons.mjs
```

which re-cuts the subset and commits nothing — the resulting `.woff2` is checked in by hand. It is
never run by the build: a network call in the release path would make an offline build fail. Every
name is checked against Google's upstream codepoint table first, because the stylesheet endpoint
echoes back whatever range it was asked for — a codepoint no glyph lives at comes back "covered" and
would ship a font that silently draws a missing-glyph box.

The symbols are addressed by codepoint rather than by ligature name, since a subset cut by codepoint
carries no ligature table and writing the name would render the literal word.
