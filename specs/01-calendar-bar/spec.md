# 01 — Calendar bar

## What & why

A Foundry VTT **v14** module for the **Pathfinder 2e** system that renders a compact pill toolbar:
in-world season, date, time, weather condition and temperature, plus GM-only controls for moving
time. Built from scratch against a supplied mockup; Seasons & Stars and Simple Calendar cover
adjacent ground and were considered and rejected.

The problem it solves: PF2e's World Clock is a separate window with fixed dawn/dusk jumps and no
weather. This puts the same information permanently on screen, adds seasonal daylight, generated
weather, and a clock that runs on its own during play.

## Toolbar anatomy

`❄  08 Kuthona  4725  11:15  Clear  -8  |  ⏸ ◀◀ ◀|  ☀↑ ☀  [unit ▾]  ☀↓ 🌙  |▶ ▶▶`

| # | Element | Notes |
| --- | --- | --- |
| 1 | Season icon | Derived from the date |
| 2 | Day + month name | Golarion month names |
| 3 | Year | Absalom Reckoning |
| 4 | Time | 24h `HH:mm` |
| 5 | Weather condition | Clear / Cloudy / Rain / Snow / … |
| 6 | Temperature | °C |
| — | *separator* | everything to its right is GM-only |
| 7 | `⏸` / `▶` | run or pause the real-time clock |
| 8 | `◀◀` / `◀\|` | retreat `N × unit` / `1 × unit` |
| 9 | `☀↑` `☀` | jump to next sunrise / noon |
| 10 | unit select | second · round (6s) · minute · hour · day · month · year |
| 11 | `☀↓` `🌙` | jump to next sunset / midnight |
| 12 | `\|▶` / `▶▶` | advance `1 × unit` / `N × unit` |

## Decisions

| Question | Decision |
| --- | --- |
| Calendar | Golarion / Absalom Reckoning, canon names |
| Time source | Sync with PF2e's World Clock — the two never show different dates |
| Weather | Generated per in-world day; GM can override |
| Sun times | Seasonal European daylight curve, not PF2e's fixed 06/12/18/00 |
| Visibility | Readout for all players; controls GM-only |
| Step arrows | Unit select drives all four: inner `±1 unit`, outer `±N units` |
| Scene weather | Our condition drives core `CONFIG.weatherEffects`; off by default |

## Acceptance criteria

1. GM sees the full bar; a player sees the readout only, with no controls in the DOM.
2. Every arrow moves time by exactly the selected unit, and PF2e's own World Clock shows the **same
   date and time** afterwards. This is the acceptance test for the sync decision.
3. Jump buttons land on the computed seasonal sunrise/sunset and always move **forward** to the next
   occurrence, never backward.
4. Crossing midnight rolls the date, regenerates the weather, and updates the season icon at a
   season boundary.
5. A GM override survives a re-render and further time advances within the same day.
6. With scene sync enabled, a "Snow" day puts snow on the canvas; entering another scene re-applies
   it; an opted-out scene stays clear.
7. Hand-authored scene weather is never overwritten.
8. With the clock running, time advances for GM and player with nobody clicking. `⏸` stops time
   while tokens still move and combat still works — the game itself is not paused.
9. With two GMs connected, time advances at the normal rate, not double.
10. After a GM disconnects and reconnects, the clock resumes where it stopped with no catch-up jump.

## Edge cases

- **No GM connected** — time does not advance. Deliberate: a silent multi-hour catch-up jump on
  reconnect would be worse than a stopped clock.
- **Two GMs** — only `game.users.activeGM` writes, for both the ticker and weather generation.
- **Month arithmetic overflow** — advancing one month from the 31st of a 31-day month clamps to the
  last day of the shorter target month rather than spilling into the next.
- **Leap years** — inherited from the Gregorian structure PF2e syncs to (see limitation below).
- **Conditions with no canvas effect** — "Cloudy"/"Overcast"/"Windy" map to no effect on a core-only
  install; with FXMaster present they can map to Clouds.
- **Indoor/underground scenes** — must be opt-out-able so they are never rained on.
- **PF2e `syncDarkness` enabled** — a running clock re-lights the scene each tick; watch for visible
  stepping at coarse tick intervals.

## Known limitation

PF2e's World Clock is **Gregorian underneath** — it renames Gregorian months to Golarion ones and
adds a year offset. Syncing to it means our months have Gregorian lengths and Gregorian leap years,
**not** canon Golarion's 8-year leap rule. This is the price of acceptance criterion 2 and cannot be
avoided while the sync holds.

Consequently a homebrew calendar can replace month/weekday *names*, era and year offset, but not
month *lengths*.

## Open questions

- None blocking. The exact `CONFIG.PF2E.worldClock` shape is pending a console dump from the live
  world; task 1 is written defensively with feature detection until it lands.

## Notes
