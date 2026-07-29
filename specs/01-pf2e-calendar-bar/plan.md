# 01 — Technical plan

## Architecture

```
src/module.ts              init/ready hooks, settings + template registration
src/settings.ts            all game.settings registrations, typed accessors
src/time/pf2e-clock.ts     ADAPTER — the only file that touches PF2e internals
src/time/calendar.ts       label resolution: data file over adapter defaults
src/time/units.ts          step unit → second delta, clamped month/year arithmetic
src/time/sun.ts            sunrise / noon / sunset / midnight for a date + latitude
src/time/season.ts         date → season key
src/time/ticker.ts         real-time clock, activeGM-only interval
src/weather/generator.ts   seeded per-day condition + temperature curve
src/weather/state.ts       world-setting read/write, activeGM-guarded regeneration
src/weather/scene-sync.ts  condition → CONFIG.weatherEffects key, guarded scene.update
src/apps/calendar-bar.ts   the toolbar (ApplicationV2)
src/apps/weather-override.ts  GM override dialog
data/calendars/golarion-ar.json  replaceable label set
templates/  styles/  lang/
```

The repository folder *is* the module folder. Vite builds `src/module.ts` → `dist/module.js`;
`templates/`, `styles/`, `lang/` and `data/` are served from the repo root, so there is no copy step.

## Key decisions

### Time is never stored by us

`game.time.worldTime` is the single source of truth. Everything displayed is derived from it and
every control calls `game.time.advance(seconds)`. No part of "the current moment" lives in our
settings.

### PF2e sync

PF2e does **not** use core `CalendarData`. Its World Clock treats `worldTime` as seconds since world
creation and does Gregorian math via luxon:

```
date  = DateTime.fromISO(settings["pf2e"]["worldClock.worldCreatedOn"]).plus({ seconds: worldTime })
year  = date.year + CONFIG.PF2E.worldClock[theme].yearOffset       // AR ≈ +2700
names = CONFIG.PF2E.worldClock[theme].months / .weekdays
```

Syncing means reusing that computation — preferably by reading `game.pf2e.worldClock` directly
rather than recomputing, so we cannot drift from it.

These are **system internals, not a public API**. All of it is confined to `src/time/pf2e-clock.ts`
behind feature detection with a self-contained fallback, so a system change breaks exactly one file.

Our own date arithmetic uses native `Date` UTC methods rather than bundling luxon — same Gregorian
semantics, one fewer dependency. Month arithmetic clamps explicitly (Jan 31 + 1 month → Feb 28/29,
not Mar 3), which native `Date` does not do for us.

### Calendar labels are data

Month names, weekday names, era and year offset load from `data/calendars/*.json`, defaulting to
PF2e's values. A homebrew set drops in by swapping the file — display only, no change to time math.

### Real-time ticker

- Only `game.users.activeGM` runs the interval and calls `game.time.advance()`. One writer.
- Shared state in a world setting `{ running, ratio, tickSeconds }` so every client's button agrees.
- Default tick **10 real seconds** advancing `ratio × 10` game seconds. `game.time.advance()` is a
  world write broadcast to all clients that re-triggers darkness sync and every module's
  `updateWorldTime` handler; ticking once a second would be ~3600 writes an hour.
- Foundry's global pause halts the ticker. Optional setting to also pause on combat start.
- No catch-up on reconnect.

### Seasonal sun times

```
δ = 23.44° · sin(360/365 · (dayOfYear − 81))
H = acos(−tan(lat) · tan(δ))        // clamped for polar edge cases
sunrise = 12h − H/15    sunset = 12h + H/15
```

Latitude configurable, default ~48°N. Yields roughly 08:00/16:00 midwinter, 04:30/19:30 midsummer.
PF2e's own buttons use fixed dawn/dusk, so the two UIs will differ on this point by design.

### Weather

Seeded by date key so a given day always produces the same weather and re-renders never reroll.
Condition from a season-weighted table; temperature as a daily min/max interpolated by hour. Stored
as `{ dateKey, condition, tempMin, tempMax, overridden }` in a world setting, written only by the
active GM.

### Scene weather sync

`scene.update({ weather: key })`, where the condition → key mapping is a setting whose options are
read from `CONFIG.weatherEffects` at `ready` rather than hardcoded. Core v14 provides Autumn Leaves,
Rain, Rain Storm, Fog, Snow, Blizzard; FXMaster registers into the same registry, so its Clouds,
Hail and Snowstorm become available with no FXMaster-specific code.

Guard rails, since this writes to Scene documents: off by default, per-scene opt-out, active-GM
only, and **never overwrite hand-authored weather** — we remember the key we wrote in a scene flag
and skip any scene whose current weather no longer matches it.

The v10 `WeatherEffects` API (`drawWeather()`, `weatherEffect`) is not how this works in v14; the
current layer is `foundry.canvas.layers.WeatherEffects`, driven by the Scene's `weather` field.

### UI

Frameless `ApplicationV2` + `HandlebarsApplicationMixin`, draggable, position saved per client.
Deliberately not injected into core's `#ui-left` DOM, which shifts between patches. Re-renders on
`updateWorldTime` and on our weather setting changing. GM half of the template guarded by
`game.user.isGM`.

## Verification

Per task: `npm run typecheck`, `npm run test`, `npm run build`.

Unit tests cover the pure modules — `sun.ts` against solstice/equinox values at 48°N, `season.ts` at
each boundary, `units.ts` across 28/30/31-day months and a leap year, `generator.ts` for determinism.
Each guard is mutation-checked once: invert a comparison, watch the test fail, revert.

In-Foundry checks are the acceptance criteria in `spec.md`.
