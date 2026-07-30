# 04 — The panel design

## What & why

`docs/foundy-kronos-design-reference.html` is where this module is going: a dark panel carrying a
day-long timeline, four readout blocks, a month grid, a calendar manager and per-day notes. Most of
that is functionality we have not written yet.

This round takes the design and leaves the functionality alone. Everything the module does today
keeps doing exactly what it does; what changes is that it does it inside the reference's panel
instead of the pill it has now. The parts of the reference that have no counterpart in the code —
the month grid, the notes, the calendar-creation wizard — are not built, and their controls are not
rendered either, because a button that does nothing is worse than a missing one.

The pill is a single row of glyphs. The panel is a card with a timeline across the top, the time and
date on the left, the weather beside them, and the time controls on the right. The reference's
markup and stylesheet are the specification: its colour tokens, spacing, radii, borders and control
styling are reproduced rather than approximated.

## Decisions

| Question | Decision |
| --- | --- |
| Scope | The card, the timeline, the four blocks, the control panel, the collapse tab. **Not** the month grid, the day notes, or the calendar wizard |
| Icons | **Material Symbols, bundled.** A 2.3 KB subset of the twenty glyphs used, committed to the repo. No network fetch at runtime |
| Icon addressing | By private-use codepoint, not by ligature name — a codepoint subset carries no ligature table |
| Players | Readout blocks and the timeline, the handle showing where in the day the sun is. No marker buttons, no drag, no control panel, no gear |
| Timeline semantics | **Sets the time inside the current day, and may rewind.** Both the handle and the five markers |
| Calendar dropdown | Omitted. Switching calendar needs a client reload, which does not belong on a one-click control in the bar |
| Weather override | Today's dialog, restyled to the reference's modal. The reference's inline picker cannot express the min/max temperatures the dialog already edits |
| Gear button | Opens Foundry's module settings |
| Position | Still dragged and still remembered per client. The panel is not docked |

## The panel

```
                                                              ┌───┐
 ┌────────────────────────────────────────────────────────────┤ ‹ │
 │   🌙            🌅          ☀              🌇         🌗   └───┤
 │   ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁●▁▁▁▁▁▁▁▁▁▁    │
 │  00:00         05:42      12:00           18:18      24:00   │
 │                                                              │
 │ ┌──────────┬────────────────┬────────────┬─────────────────┐ │
 │ │  22:00   │ MARTIA         │ ☁ 14°C     │ ⏸ ⏪ ◀ [unit▾]  │ │
 │ │  00s     │ 08 Enudar 3658 │   Overcast │      ▶ ⏩  │ ⚙  │ │
 │ │          │ SPRING ✦FEAST  │            │                 │ │
 │ └──────────┴────────────────┴────────────┴─────────────────┘ │
 └──────────────────────────────────────────────────────────────┘
```

**Timeline.** One in-world day, midnight to midnight. Five markers above it — 00:00, sunrise, noon,
sunset, 24:00 — placed at the fraction of the day each falls on, with the time printed underneath.
Sunrise and sunset come from the solar model, so they move across the year and the markers move with
them. The gold handle sits at the current time. A GM may drag it, click anywhere on the bar, or click
a marker; all three set the clock to that time **today**, which means they can move time backwards.

**Time.** `HH:MM` large, gold, monospace. Seconds underneath, muted.

**Date.** The weekday in gold uppercase, then day, month and year. The season as a gold tag. A
festival, on the days that carry one, as a second tag beside it.

**Weather.** Condition icon, temperature, condition name. Clickable for a GM; hidden entirely when
weather is switched off.

**Controls.** GM only: run/stop, the four step arrows, the unit select, and the gear. The solar jumps
move out of this row and onto the timeline, where the reference puts them.

**Collapse tab.** A tab on the outside of the right border. It drops the panel to the reference's
compact width, hiding the timeline, the tags, the weather and the outer step arrows — the time, the
date, the inner arrows and the unit select stay. The choice is remembered per client.

## Deviations from the reference, and why

| Reference | Here | Why |
| --- | --- | --- |
| `00s (Round 1)` under the time | `00s` | A round counter derived from the wall clock would contradict Foundry's encounter tracker, which owns the real round number |
| No run/stop control | One, first in the control panel | The module has a running clock; the reference does not |
| `calendar_month` button | Not rendered | The month grid is not in this round |
| Calendar dropdown in the tag row | Not rendered | See the decisions |
| Inline weather picker | The existing dialog, restyled | See the decisions |
| Season shown as a text tag only | Same | The emoji season icon the pill used is dropped, and `SEASON_ICONS` with it |
| Global `* { user-select: none }`, `body` styles | Scoped under `#foundry-kronos` | The reference is a standalone page; this is a module inside someone else's application and must not restyle it |

## Acceptance criteria

- The panel reproduces the reference's tokens: `#0f1318` card on a `#1d242e` border, 12px radius,
  `0 8px 32px rgb(0 0 0 / 60%)` shadow, `#e5a93c` gold, `#d1d5db` text, `#6b7280` muted, `#171d26`
  controls, and the reference's paddings, gaps and radii.
- No stylesheet rule applies outside `#foundry-kronos`, and no `@font-face` name can collide with a
  font Foundry or another module registers.
- Icons render with no network access. The font file is inside the packaged module, and the packaged
  path is asserted by a test.
- A GM dragging the handle to the left half of the bar at 22:00 moves world time backwards, and the
  handle lands where it was dropped.
- The sunrise and sunset markers sit where the solar model puts them for the current day and
  latitude, and their labels read the same times.
- A player sees the readouts and the timeline. No marker button, no handle drag, no control panel and
  no gear are present in their DOM — not merely hidden.
- Collapsed, the panel is the reference's compact width, hides the timeline, tags, weather and outer
  arrows, and keeps the unit select usable. Reload restores the collapsed state.
- Every control that existed on the pill still works: run/stop with its stalled state, the four step
  arrows against the selected unit, the seven units, the four solar targets, and the weather
  override.
- The panel is still dragged by its background and its position still persists, and dragging the
  timeline does not move the panel.
- `npm run check` passes.

The one thing no check here can settle is the override dialog's look. It is a separate application, so
its styling hangs off Foundry's own `window-header` / `window-title` / `window-content` element names,
and only a running world shows whether those rules land. It is on the verification list.

## Edge cases

- **Polar latitudes.** `solarEvents` returns nominal times with `polar` set when the sun never
  crosses the horizon. The sunrise and sunset markers then coincide, or sit at the ends. They are
  still placed and still clickable; nothing special is drawn.
- **A day already at the target time.** Setting the clock to the time it already is is a zero-second
  advance, which `advance` short-circuits.
- **Weather off.** The weather block is absent, and the controls grid closes over the gap rather than
  leaving a hole.
- **No festival.** The second tag is absent, not empty.
- **Long month or weekday names.** The date line does not wrap — reflowing under itself reads as a
  layout fault, and the design keeps it on one line. The blocks size to their content, so a very long
  name pushes the row rather than reflowing it.
- **Compact and player at once.** A player's panel has no control panel, so compact leaves the time
  and date only.
- **The font failing to load.** Icons show as the browser's missing-glyph box. Every control keeps
  its `aria-label` and `title`, so nothing becomes unusable.
- **Re-render during a drag.** The clock ticks every ten seconds and re-renders the panel; a drag in
  progress must not be interrupted, the same way the existing panel drag is protected.

## Notes

The reference is in Portuguese. Only its structure and styling are taken; every string on the panel
continues to come from `lang/en.json`.
