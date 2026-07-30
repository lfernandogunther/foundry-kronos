# 04 — Tasks

One commit per item. Task 3 is the one that cannot be split: markup without the stylesheet, or the
stylesheet without the markup, leaves the panel broken on the branch.

- [x] **1. The bundled icon font** — `src/apps/icons.json` with the twenty name → codepoint entries
      and `src/apps/icons.ts` over it, including the weather-condition mapping and its clear-night
      variant. `tools/fetch-icons.mjs` regenerates `styles/fonts/kronos-symbols.woff2` from that file
      and checks every name against the upstream codepoint table — the stylesheet endpoint echoes back
      whatever range it was asked for, so a made-up codepoint comes back "covered". The subset
      committed, the `@font-face` named `Kronos Symbols` in `kronos.css`, `package.mjs` extended to
      check the assets its stylesheets reference, and the tests: codepoint shape and range, names
      present, the clear-night variant, the `url()` resolving, and the family name not shadowing the
      real font. Snow is `ac_unit`, not `weather_snowy`, which is indistinguishable from `rainy` at
      the size the panel draws it

- [x] **2. Setting the time inside a day** — `secondsToTimeOfDay(worldTime, minutes)` in
      `src/time/clock.ts`, signed and confined to the current in-world day, with tests for earlier,
      later and now. Delete `secondsUntilTimeOfDay` if the build proves it has no remaining caller

- [x] **3. The panel** — `calendar-bar.ts` rewritten to the reference's structure (wrapper, collapse
      tab, panel, timeline, controls grid) and `kronos.css` rewritten to its tokens and layout, every
      rule under `#foundry-kronos`. `src/apps/timeline.ts` for the geometry, with the tests from the
      plan. The player path returns before the markers, the control panel and the gear are built.
      `SEASON_ICONS` deleted, against the build

- [x] **4. Timeline interaction** — markers, bar clicks and handle drag, all through
      `secondsToTimeOfDay`. The handle follows the pointer locally and world time is written once, on
      release. Panel dragging still ignores the timeline

- [x] **5. Compact mode** — folded into task 3: the collapse tab and its rules are part of the same
      markup and the same stylesheet, and shipping the tab a commit before it did anything would have
      left a dead control on the branch. The `barCompact` client setting, the tab toggling it, and the
      reference's compact rules: narrower panel, timeline, tags, weather, seconds and outer arrows
      hidden, the unit select kept

- [x] **6. Weather and the override dialog** — the condition icon and temperature in the reference's
      weather block, and `kronos-modal` on the override dialog so its styling reaches the reference's
      modal look. No change to what the dialog does

- [x] **7. Strings and the README** — `lang/en.json` for the tab, the gear, the timeline and the
      reworded solar targets; the README's controls table, the timeline's within-the-day semantics
      replacing the forward-only wording, and the collapse tab. The pill diagram at the top replaced

## Verify

After task 7: `npm run check`, the scratchpad harness against the reference, then
`npm run install:foundry` and the panel in a world as a GM and as a player.
