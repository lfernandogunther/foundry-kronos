# 10 — Tasks

One commit per item. Storage lands first and alone, since it is the thing the pre-spec argued over —
everything after it is markup hung off a fact that already works.

- [x] **1. Storage, and the key that names a day without a time of day** — `SETTINGS.dayNotes` in
      `src/settings.ts` (world scope, not in the config sheet, default `{}`), with `getDayNotes` /
      `setDayNotes`. `dayKeyAt(year, month, day)` in `src/time/clock.ts`, dispatching on whether the
      calendar owns its months, tested against both backends by agreeing with
      `getWorldDate(worldTimeAtDate(...)).dayKey`. `src/time/notes.ts`: `noteFor`, `setNote` (trims;
      clears rather than stores when empty), `clearNote`

- [x] **2. The marker, as data** — `MonthDay.hasNote` in `src/apps/month-grid.ts`; `monthView` takes the
      notes map as a parameter rather than reading settings itself. Tests: only the day named by a key in
      the map is marked; a blank entry in the map marks nothing

- [x] **3. The edit modal** — `src/apps/day-note.ts`, a `DialogV2.wait` form with a textarea, Save, and a
      Delete button shown only when a note already exists — the same shape as `weather-override.ts`.
      The current text escaped going into the form, so a note containing `<` or `&` cannot break the
      dialog's markup. One new glyph checked into `icons.json` against the upstream codepoint table and
      the font regenerated. `KRONOS.Action.EditNote`, `KRONOS.Note.*` in `lang/en.json`

- [x] **4. Wired into the grid** — the marker class on any cell `hasNote` names, distinct from
      `kronos-today` and `kronos-selected` at all three sizes; the edit-note control on the selected
      cell, beside go-to-day; the `edit-note` click case resolving that cell's `dayKey` via `dayKeyAt`
      and opening the modal. Tests: the control is absent for a player and until a day is selected,
      present only on the selected cell, and clicking it does not call `advance`

- [x] **5. The harness and the README** — a `note` query param seeding `dayNotes` for the day shown, a
      gallery case with the grid open on a day carrying one, and the README's controls table

## Verify

`npm run check`. Then, in the harness: the marker at all three sizes, both with and without a note on
the day shown; the selected cell's two controls fitting without overflow at the small size; opening,
editing and deleting a note round-tripping through the modal; whitespace-only text leaving no marker;
and text containing `<` and `&` surviving the round trip intact.
