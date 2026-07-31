# 09 — The month grid (pre-spec)

Not a spec yet. What it is, what is already settled, and what has to be answered before one is written.

## What

The view behind the reference's `calendar_month` button, which round 04 deliberately does not render:
a month at a time inside the panel, weekday headers across the top, one cell per day, today marked, and
arrows to move month by month.

## Already settled

- It is GM-and-player or GM-only by decision below, but the *button* is a panel control, so it follows
  the same rule as the rest of the control panel unless we say otherwise.
- It lives inside the card, under the readout row, as the reference has it — not a separate window.

## To decide before the spec

1. **Does clicking a day move world time, or only navigate?** The reference moves. This is the first
   place in the module where one click can move time by weeks, and a misclick would drag a party three
   weeks forward. Options: move on click; move only on double-click; navigate on click with an explicit
   "go here" action; or move but make it undoable.
2. **What does a cell show?** The reference shows the day number and a note indicator. We also have
   festivals, seasons and per-day weather, all derivable. Each one added is a cell that is busier and a
   grid that is taller.
3. **Player visibility.** The reference has no notion of players. A read-only month is genuinely useful
   to a player; the button that opens it is currently in the GM-only control panel.
4. **How it behaves at the three sizes.** Seven columns at 440px is roughly 55px per cell, which is what
   the reference's cells are at full size. The grid may not survive small, and "the grid forces large"
   is an acceptable answer if we say it out loud.
5. **Where the month being viewed lives.** Browsing to March and leaving it open while the clock ticks
   into April — does the view follow the clock or stay where it was put?

## Touches

`src/apps/calendar-bar.ts` (the toggle and the view), a new `src/apps/month-grid.ts`, `styles/kronos.css`,
and one genuinely new piece of arithmetic:

**The inverse of what `reckoning.ts` does today.** It converts a world time into year/month/day; the grid
needs the world time a given year/month/day begins at, for both backends — the fixed-length reckoning and
the Gregorian one. Contained and testable, and worth writing with its own tests before any markup.

## Size and dependencies

Medium. Nothing blocks it. It blocks 10, which needs somewhere to show a note.
