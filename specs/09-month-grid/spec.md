# 09 — The month grid

## What & why

The reference has a `calendar_month` button that opens a month at a time inside the panel: weekday
headers, a cell per day, today marked, and arrows to move between months. Round 04 deliberately did not
render that button, because the view behind it did not exist.

This builds it, and answers a question the panel cannot answer today: *when* is something — the festival,
the solstice, the day the party said they would be back. The bar states one day at a time and the
timeline states one day's shape. Neither shows a month.

## Decisions

| Question | Decision |
| --- | --- |
| Clicking a day | **Selects it. It does not move time.** Moving is a separate, explicit control on the cell |
| The cell | The day number, and today marked. Nothing else this round |
| Who sees it | **GM only.** The button lives in the control panel, which is GM-only, so it inherits that |
| The three sizes | Scales with the size tokens, like everything else |
| Where the view sits | Inside the card, below the readout row, as the reference has it |
| Which month it opens on | The current one |
| The clock crossing a month boundary while open | The view follows **only if it was showing the current month**. Browsing March and being yanked into April by a clock tick is worse than a stale heading |

### Why clicking does not move time

The grid is the first place in this module where one click could move time by weeks. The step arrows move
by a chosen unit and the timeline stays inside one day; a month grid can put the party three weeks
forward, and every such move fires `updateWorldTime`, re-syncs scene darkness and weather, and every
other module's handler runs.

So the grid is a view first. A day is selected by clicking it, and a second, explicit control on the
selected cell is what moves the clock there. Two gestures for a jump that large is the right price.

### What selection is for, since notes are not in this round

A selection nothing consumes is a smell, so it gets the smallest honest purpose: **the grid's heading
names the selected day, and its festival when it carries one.** That answers "what is the 20th of
Zyullian?" without moving the world, and it uses only what the calendar already knows. Round 10 gives it
the larger purpose.

## Where the reference is wrong, and we should not copy it

The reference renders weekday headers and then lists days 1 to n **with no leading offset**. Its columns
are therefore decorative: the 1st always lands in the first column whatever weekday it is.

We have real weekday arithmetic, so day 1 goes in its own weekday's column and the row before it is
blank. That is the whole point of having headers.

## Acceptance criteria

- A control in the GM's control panel opens and closes the grid, and shows as active while it is open.
- The grid shows one month: a header per weekday of the active calendar, and a cell per day of that
  month, with **day 1 in the column of the weekday it actually falls on**.
- Today's cell is marked, and only when the month on screen is the month today is in.
- Arrows move a month at a time, across a year boundary in both directions, without moving world time.
- Clicking a day selects it. World time does not change. The heading names the selected day.
- The selected cell carries a control that moves world time to that day, keeping the time of day, and
  only that control moves time.
- It works for both bundled calendars: Golarion's twelve Gregorian months with February and leap years,
  and Tarlan's twelve months of its own.
- A player's panel has no grid and no button to open one.
- The grid scales with the three sizes, and nothing overflows the card at any of them.
- `npm run check` passes.

## Edge cases

- **A month the calendar has no such day in.** Moving from a 31-day month to a 30-day one while day 31 is
  selected: the selection is dropped rather than clamped, since a clamped selection silently means a
  different day than the one clicked.
- **February.** Golarion is Gregorian underneath, so the grid must show 28 or 29 days according to the
  year — the year the *Gregorian* calendar is in, not the displayed Absalom Reckoning one.
- **A calendar with an unusual number of weekdays.** Any count is legal. Ten weekday columns at the small
  size makes narrow cells; the width floor widens the panel rather than clipping them.
- **A year before the calendar's epoch.** The reckoning numbers years continuously with no gap at zero,
  so navigating back past year 1 is arithmetic, not an error.
- **The grid open while the clock runs.** It re-renders on every tick like the rest of the panel, so
  today's marker has to be derived at render rather than latched.
- **The grid open when the calendar changes.** Weekday count and month lengths both change; the view
  resets to the current month rather than trying to translate.

## Open questions

1. **Do seven columns survive the small size?** Roughly 55px a cell at 440px, which is what the
   reference's cells are at full width. Measured in the harness before the token values are chosen, not
   estimated — the same discipline as round 06, where an estimate was right by luck and a first
   measurement was wrong by transition.

## Notes

The pre-spec claimed this needed a new arithmetic — the world time a given date begins at — and that was
wrong. `reckoning.ts` already exports `worldTimeAt`, `pf2e-clock.ts` already exports `utcMsToWorldTime`,
and `gregorian.ts` already exports `daysInMonth`. All three exist because the step and jump controls
needed them. What is missing is only a facade that picks the right one, which makes this round cheaper
than the roadmap says.
