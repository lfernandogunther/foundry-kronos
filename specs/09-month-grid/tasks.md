# 09 — Tasks

One commit per item. Task 1 is pure arithmetic and lands before any markup, so the thing the reference got
wrong is settled where it can be tested.

- [x] **1. A date back into a world time, and a month's shape** — `worldTimeAtDate` and `monthShape` in
      `src/time/clock.ts`, each dispatching on whether the active calendar owns its months, both taking and
      returning the displayed year so the era offset is applied on the way in. Tests for both backends:
      round-tripping against `getWorldDate`, the time of day preserved, February's 28 and 29, Tarlan's own
      lengths, a year before the epoch, and the count of leading blanks

- [x] **2. The month as data** — `src/apps/month-grid.ts`: the weekday headers, the blanks before day 1,
      and one entry per day carrying its number and whether it is today. Pure, no DOM. The leading blanks
      are the point — the reference lists days 1 to n with no offset, which makes its weekday columns
      decorative, and this is where that is fixed

- [x] **3. The grid on the panel** — the toggle in the GM control panel, the view under the readout row,
      month navigation, and today marked. `calendar_month` into `icons.json` and the font regenerated.
      Its own size tokens and three value sets in `kronos.css`, measured in the harness rather than
      derived — the spec's open question is whether seven columns survive the small size

- [x] **4. Selecting a day, and going to it** — clicking a cell selects it and moves nothing; the heading
      names the selected day and its festival; the selected cell carries the one control that moves world
      time, through the same `advance` path as every other control. A test that a day cell carries no
      action that moves time, which is how this decision would regress

- [ ] **5. The harness and the README** — `?grid=1`, the grid in the gallery for both calendars and all
      three sizes, and the README's controls table

## Verify

`npm run check`. Then, in the harness: day 1 under the right weekday for both bundled calendars, checked
against a date whose weekday is known independently; February in a leap year and a common one; the three
sizes with cell width and overflow measured rather than eyeballed; a day click confirming `advance` is not
called; and the go-to-day control confirming one call with the right delta.
