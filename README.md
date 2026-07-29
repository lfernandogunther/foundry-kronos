# PF2e Calendar Bar

A floating toolbar for Foundry VTT v14 showing the in-world season, date, time, weather and
temperature, with GM controls for moving time. Built for the Pathfinder 2e system.

```
❄  08 Kuthona  4725  11:15  Clear  -8  |  ⏸ ⏪ ◀  🌅 ☀  [unit ▾]  🌇 🌙  ▶ ⏩
```

Players see the readout. Everything right of the separator is GM-only.

## Installing for testing

The repository folder *is* the module folder, so build it and point Foundry at it:

```bash
npm install
npm run build
```

Then link it into your Foundry data directory:

```bash
ln -s "$(pwd)" "<FOUNDRY_DATA>/Data/modules/pf2e-calendar-bar"
```

`<FOUNDRY_DATA>` is the path shown under *Configuration → User Data Path* in Foundry's setup
screen. Restart Foundry, then enable **PF2e Calendar Bar** in *Manage Modules*.

While working on it, `npm run dev` rebuilds on save — reload the browser tab to pick changes up.

## How it keeps time

World time is never stored by this module. Everything on the bar is derived from
`game.time.worldTime`, and every control calls `game.time.advance()`.

Dates are reconstructed with the same formula PF2e's own World Clock uses — world creation
timestamp plus `worldTime` seconds, read in UTC, with the Absalom Reckoning year offset applied —
so the two never disagree. At startup the module compares itself against the system clock and logs
a warning if they drift.

Because PF2e's clock is Gregorian underneath, months have Gregorian lengths and Gregorian leap
years rather than canon Golarion's eight-year rule.

## Controls

| Control | Does |
| --- | --- |
| `⏸` / `▶` | Stops or starts **time only** — the game keeps running |
| `⏪` `◀` `▶` `⏩` | Move by the selected unit; outer arrows move the configured multiple |
| `🌅` `☀` `🌇` `🌙` | Jump forward to the next sunrise, noon, sunset or midnight |
| unit select | second, round (6s), minute, hour, day, month, year |
| condition / temperature | GM click opens the weather override |

Sunrise and sunset shift across the year from a configurable latitude, defaulting to central
Europe. PF2e's own World Clock uses fixed dawn and dusk times, so its jumps land elsewhere.

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

## Custom calendars

Month names, weekday names, era and year offset come from a JSON file. Point the *Calendar file*
setting at your own copy of `data/calendars/golarion-ar.json` to rename them.

This changes display only. Month lengths come from the Gregorian structure the PF2e sync is built
on and cannot be redefined.

## Development

```bash
npm run typecheck
npm run test
npm run check     # all of the above plus the build
```
