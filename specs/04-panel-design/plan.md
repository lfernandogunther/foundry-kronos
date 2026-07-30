# 04 — Plan

## The shape of the change

This is a presentation change with one behavioural seam under it.

`WorldDate` already carries everything the panel displays, and `settings.ts` already carries
everything it reads. So `calendar-bar.ts` and `kronos.css` are rewritten, and almost nothing else
moves. The one exception is the timeline, which needs an arithmetic the module does not have:
`secondsUntilTimeOfDay` is deliberately forward-only, and a timeline needs a signed delta so
dragging left moves left.

```
                    ┌── timeline.ts  (pure: %, marker times, handle position)
WorldDate ──▶ bar ──┤
                    └── icons.ts     (name ─▶ private-use codepoint)

clock.ts:  secondsUntilTimeOfDay  (forward-only, unchanged — nothing else uses it after this)
           secondsToTimeOfDay     (new, signed, inside the current day)
```

Two pieces come out of the render function so they can be tested without a DOM: the timeline
geometry, and the icon table. Everything else in the panel is markup.

## Files

| File | Change |
| --- | --- |
| `src/apps/icons.json` | **New.** Icon name → four-digit private-use codepoint. The single source: the TypeScript imports it, and the font-fetching tool reads the same file |
| `src/apps/icons.ts` | **New.** Typed access to the table, and the condition → icon mapping including the clear-night variant |
| `src/apps/timeline.ts` | **New.** Pure geometry: the five marker positions and their times, and the handle position, from a `WorldDate` and a latitude |
| `src/apps/calendar-bar.ts` | Rewritten render: wrapper, collapse tab, panel, timeline, controls grid. Timeline pointer handling. Gear opens module settings. The GM/player split becomes structural |
| `src/time/clock.ts` | `secondsToTimeOfDay(worldTime, minutes)`: signed, within the current in-world day |
| `src/time/season.ts` | `SEASON_ICONS` deleted — the panel shows the season as a text tag |
| `src/settings.ts` | `barCompact`, client-scoped, unlisted |
| `styles/kronos.css` | Rewritten from the reference. `@font-face`, tokens on `#foundry-kronos`, the panel, the timeline, the blocks, the controls, the compact rules, the modal |
| `styles/fonts/kronos-symbols.woff2` | **New.** The subset. `package.mjs` already copies `styles/` recursively, so it is packaged with no change there |
| `tools/fetch-icons.mjs` | **New.** Regenerates the subset from `icons.json`. Run by hand when an icon is added; not part of the build |
| `src/apps/weather-override.ts` | A `kronos-modal` class onto the dialog so the reference's modal styling reaches it. No logic change |
| `lang/en.json` | Strings for the tab, the gear, the timeline and the reworded solar targets |
| `README.md` | The controls table, the timeline's semantics, and the collapse tab |

## Key decisions

**The icon font is addressed by codepoint.** Google's `css2?...&text=` endpoint subsets by character,
which produces a 2.3 KB file for the nineteen glyphs — but a codepoint subset carries no ligature table, so
`<span>wb_sunny</span>` would render as the literal word. Writing `""` works either way and
cannot silently degrade. `icons.json` holds the codepoints as hex strings so the file is readable and
so `fetch-icons.mjs` can build the `text=` parameter from it without parsing TypeScript.

**The subset is committed, not built.** Fetching from Google during `npm run build` would put a
network call in the release path and make an offline build fail. The tool exists so the file is
reproducible rather than mysterious; it asserts the returned font is non-empty and covers every
codepoint the CSS declares.

**`@font-face` is named `Kronos Symbols`**, not `Material Symbols Outlined`. Another module fetching
the real font would otherwise collide with our nineteen-glyph subset and lose most of its icons.

**Timeline geometry is a pure function.** `timelineLayout(date, latitude)` returns the handle
percentage and the five markers as `{ action, target, minutes, percent, label }`. That makes the
placement testable — the sunrise marker sitting where the solar model says is an acceptance
criterion — and keeps the render function to markup.

**The forward-only jump stays in `clock.ts`.** `secondsUntilTimeOfDay` loses its only caller in this
round, but it is the arithmetic behind "the next sunrise" and deleting it would take the choice away
from a later round that wants both. It stays, exported, with its existing test.

Correction to that: an exported function with no caller is dead weight, and the repo's rule is to
prove dead code by deleting it and building. So the deletion is task 2's decision, made against the
build rather than against this paragraph — if nothing else references it, it goes, and the signed
version is the only one.

**The GM/player split is structural, not visual.** `_renderHTML` returns early for a player before
building the markers, the control panel and the gear, the way it already returns early today. A
disabled control a player can see is an invitation to ask the GM to press it.

**Compact mode is CSS, not markup.** The collapse tab toggles a class on the wrapper and the
stylesheet hides what the reference hides. The state is a client setting, read at render.

## Timeline interaction

Three gestures, one destination:

- click a marker → its minutes
- click the bar → the minutes under the pointer
- drag the handle → the minutes under the pointer, continuously

All three call `advance(secondsToTimeOfDay(worldTime, minutes))`, which is signed and stays inside
the current day. A drag issues one `advance` per pointer move, which is a world write per move — so
the handle is moved locally during the drag and the write happens once, on release. The existing
`#applyStoredPosition` guard is the precedent: a re-render mid-gesture must not fight the pointer.

The bar carries `data-action`, so the existing panel-drag handler already ignores it — pointer-down on
the timeline will not start moving the panel.

## Tests

| Test | Guards |
| --- | --- |
| `tests/apps/timeline.test.ts` | Handle at 0% at midnight, 50% at noon, ~100% at 23:59. Markers ordered and inside 0–100. Sunrise and sunset percentages equal `solarEvents` for the same day and latitude. Polar day and polar night place markers without NaN |
| `tests/time/clock.test.ts` | `secondsToTimeOfDay` is negative when the target is earlier in the day, zero when it is now, and never leaves the day |
| `tests/apps/icons.test.ts` | Every value in `icons.json` is four hex digits; every name the panel uses is present; the `@font-face` in `kronos.css` names a file that exists on disk |
| `tests/manifest.test.ts` | Extended: the packaged module contains the font at the path the stylesheet requests |

The last one is the failure this design is most exposed to — a renamed or unpackaged font file breaks
every icon in the panel at once, and does it silently, in an installed module rather than in CI.

Each of these is mutated once before being trusted: the codepoint test with a five-digit value, the
font-path test with a renamed file, the sunrise test with an inverted latitude.

## Verification

`npm run check` covers the build, the types and the tests, none of which see a browser.

The panel itself is checked in one: a scratchpad HTML harness that loads the real `styles/kronos.css`
and the real font file and mounts the markup the render function produces, opened side by side with
`docs/foundy-kronos-design-reference.html`. That confirms the two things tests cannot — that the
glyphs resolve from the bundled subset, and that the layout matches the reference. The harness is not
committed.

Foundry itself is the last check, after the tasks: `npm run install:foundry`, then the panel in a
world, as a GM and as a player.

## Open

- Which API opens the module's own settings tab in v14 — `game.settings.sheet.render(true)` reaches
  the sheet; whether it can be pointed at our tab is to be confirmed against the running application
  rather than guessed. Falling back to the sheet's default tab is acceptable.
- The reference's panel is 880px wide. Over a canvas, above the hotbar, that is wide but it is what
  the reference specifies; if it proves unusable in a real world the compact width is already there.
