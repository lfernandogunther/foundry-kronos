# 06 — Tasks

One commit per item. Task 1 is deliberately a no-op refactor, so that anything that changes afterwards
is attributable. Task 2 lands before the sizes are measured, because it changes what a player's panel
*is* and the measurement has to be taken against the final shape.

- [x] **1. Tokenise the stylesheet** — every scaling value under `#foundry-kronos` becomes a custom
      property on `.kronos-wrapper`, with today's values. The dialog's own rules are left alone: it is a
      separate window and does not scale with the panel. `tests/styles.test.ts` gains the check that
      every `var(--kronos-…)` used is a token that is defined. Large must come out pixel-identical —
      shown by the harness before and after, not assumed

- [x] **2. A player loses the timeline** — the timeline is built only for a GM, so a player's panel is
      one row: time, date, weather. `#timeline` loses its `isGM` parameter and both of the branches that
      depended on it, since the markers and the track's action are now unconditional. The player tests
      collapse from a list of absences to one assertion that also checks the row is still there, which
      is what stops it passing on a render that threw

- [ ] **3. The size setting and the class** — `src/apps/size.ts` with `BarSize`, the list and a guard;
      `barSize` in `settings.ts` as a listed client setting defaulting to medium and re-rendering on
      change; `kronos-size-<size>` on the wrapper. Strings in `lang/en.json`. Tests: the guard, the
      class per size, medium when unset, and medium when the stored value is nonsense

- [ ] **4. Medium and small values** — starting with the measurement the spec's open question asks for:
      the controls row's real width at every size, expanded and compact, GM and player, against the
      longest month and weekday names the bundled calendars contain. Then the two token sets, and
      `min-width: max-content` as the floor. Also: a panel with no timeline sizes to its content —
      the nominal width exists so the timeline can be a proportional bar, and a player has no bar, so
      at 880 their single row is a mostly empty card. `tests/styles.test.ts` gains the check that all
      three blocks define the same names

- [ ] **5. What small gives up** — `data-target` on the timeline labels, then in CSS: no seconds line
      and no sunrise or sunset label at small. Plus whatever task 4's measurement showed is needed
      horizontally — the long-step arrows first, the condition text second, and neither without the
      number to justify it. A test that the cuts are not structural: the markup is identical at every
      size

- [ ] **6. The harness and the README** — `?size=` on the harness and all six states in its gallery;
      the README's controls table and development section covering the setting, what small drops, and
      the player's panel no longer carrying a timeline. The diagram at the top of the README currently
      shows a player seeing the timeline and has to stop saying that

## Verify

`npm run check`. Then, in the harness: large unchanged by task 1; all six states at both calendars, GM
and player, with no overflow, measured by `scrollWidth` against `clientWidth` rather than by eye; the
smallest rendered text measured against the `0.6rem` floor; and a drag at small.
