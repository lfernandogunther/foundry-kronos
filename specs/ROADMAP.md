# Candidate specs

What is left, where it comes from, and in what order it makes sense. Nothing here is agreed — this is
the list to argue with, one at a time. Numbers are the spec folder each would take if we start it.

Rounds 01–06 are done and released as 0.4.0. Numbers 07 and 08 are reserved for the backlog below.

## Where the work comes from

Two sources, and they should not be confused.

**The design reference** (`docs/foundy-kronos-design-reference.html`) is a working prototype of the whole
thing. Its panel is built. What is not built is everything behind two of its buttons: the month grid and
the settings modal — and the settings modal is really three features stacked (a calendar library, a
creation wizard, and import/export).

**Our own debt** is smaller but real: one language, a control path that has never been seen working, and
a weather model that disagrees with the reference's.

## The list

Each of the eight below has a `pre-spec.md` in its folder: what it is, what is already settled, and the
questions to answer before a real spec is written. A pre-spec is not a plan — it is the argument to have
first, written down so it is not re-derived at the keyboard.

| # | Spec | From | Size | Blocked by | State |
| --- | --- | --- | --- | --- | --- |
| 07 | Brazilian Portuguese | ours | S | — | **backlog** |
| 08 | Size and collapse from the panel | ours | S | — | **backlog** |
| 09 | The month grid | design | M | — | **done** |
| 10 | Day notes | design | M | 09 for where they show | **spec** |
| 11 | Export and import a calendar | design | S | — | pre-spec |
| 12 | Calendars as world data, and the wizard | design | **L** | 11 | pre-spec |
| 13 | Per-season light and temperature | design | M | — | pre-spec |
| 14 | Step modes as pairs | design | S | — | pre-spec |
| 15 | The inline weather picker | design | S | — | pre-spec |
| 16 | Round and encounter awareness | design | S | — | pre-spec |

Deferred deliberately, not forgotten. 07 and 08 keep their numbers and have no folder until we pick one
up, so their reasoning is written out below. Everything from 09 on has a pre-spec, and the pre-spec is
the source — the entries here are one paragraph and a pointer, so the two cannot drift.

---

## 07 — Brazilian Portuguese *(backlog)*

`lang/en.json` is the only language file, and the reference was written in pt-BR, which says who this is
for. The plumbing already exists and the i18n test already guards every key, so this is mostly
translation.

The reason to do it first is not politeness. **A second language is the first real test of the width
floor** built in round 06: "Configurações" is half again as long as "Settings", and `Min / Horas` is
wider than `Minute`. If a translation breaks the panel's layout, the size work is not finished, and this
is how we find out.

Open: whether pt-BR becomes the default when Foundry's language is pt-BR (it does that automatically) —
nothing to decide, but the month and weekday names in the bundled calendars are *not* localised and
arguably should not be. Golarion's months are proper nouns.

## 08 — Size and collapse from the panel *(backlog)*

The size chosen in round 06 is only reachable through the settings sheet, and the panel's own gear —
the shortcut to it — is one of the two things that has never been verified in a running Foundry. So the
one control that fixes "everything is too big" sits behind the one path we are least sure of.

Putting it on the panel removes that dependency. Options to discuss: cycling the size from the collapse
tab (double-click? a second tab?), a small control in the row, or a context menu on the panel
background. The last is probably right — it is invisible until wanted and costs no width.

Small, and it makes the 0.4.0 feature actually discoverable.

## 09 — The month grid → [spec](09-month-grid/spec.md) · **done**

Built. Clicking a day selects it and moves nothing; an explicit control on the cell moves the clock.
Cell shows the day number and today. GM only. Scales with the size tokens.

The pre-spec was wrong about the cost: the inverse arithmetic already exists, so this is cheaper than M.
And the reference is wrong about the grid — it renders weekday headers but lists days with no leading
offset, making its columns decorative. We align day 1 to its weekday.

## 10 — Day notes → [spec](10-day-notes/spec.md) · **spec**

Text attached to an in-world day, shown in the grid. GM-only, one note per day, keyed by `dayKey` —
plain and player authorship were both considered and dropped: a world setting cannot be written by a
player at all, and is not private from one regardless of scope, so the per-note visibility modes that
would have needed real privacy went with it. Notes keyed by `dayKey` still vanish when a world switches
calendar, the same known property weather overrides already have.

## 11 — Export and import a calendar → [pre-spec](11-calendar-export-import/pre-spec.md)

The reference's import/export bar. Most of it exists — `parseCalendar` reads the format and the *Calendar
file* setting already loads one.

**The argument to have first:** a browser can offer a download but cannot write to the server, so import
either stores the JSON in world data or uploads a file. Choosing the first is choosing part of 12.

## 12 — Calendars as world data, and the wizard → [pre-spec](12-calendars-as-world-data/pre-spec.md)

The library and the five-step wizard. Not a UI feature — it moves where the truth lives, from files to
world data.

**The argument to have first:** may the calendar a running world is already reckoning in be edited at
all? Change a month's length and every date after it moves, and our epoch anchoring shifts the whole
timeline. Wants 09, 10 and 11 first.

## 13 — Per-season light and temperature → [pre-spec](13-season-light-and-temperature/pre-spec.md)

A disagreement with the reference, not a gap. It stores sunrise, sunset and temperatures per season; we
compute all four from latitude and a seasonal curve.

**The argument to have first:** whether the answer is neither — a calendar overriding where it states a
value and computing where it does not. That keeps Tarlan's solstices honest and still lets someone build
a world with a fixed six-hour day.

## 14 — Step modes as pairs → [pre-spec](14-step-modes/pre-spec.md)

Ours is a unit plus a multiplier; the reference pairs them into four modes. Theirs reads better on a
narrow panel, ours is more flexible.

**The argument to have first:** replace or add. Also whether a longer label like `Meses / Anos` works
against round 06, since the select is already one of the widest things in the row.

## 15 — The inline weather picker → [pre-spec](15-inline-weather-picker/pre-spec.md)

The reference's dropdown on the weather block. We open a dialog instead, because it also edits the two
temperatures the picker cannot express.

**Blocked in practice:** the dialog's styling has never been seen in a running Foundry. No point building
the second thing on that surface before the first is verified.

## 16 — Round and encounter awareness → [pre-spec](16-encounter-round/pre-spec.md)

The reference derives a round number from the wall clock, which would contradict Foundry's encounter
tracker. The version that is not wrong: when an encounter is running, show *its* round.

**The argument to have first:** what the line says when no encounter is running, and where the round goes
at the small size, which hides that line entirely.

---

## What is not on the list, and why

- **The calendar dropdown on the panel.** It needs switching without a reload, which is part of 12. Not
  a spec of its own.
- **The `(Round 1)` text as the reference has it.** Superseded by 16.
- **Harness improvements** (on-page size controls, a stubbed settings sheet). Useful, but it is tooling
  for us and loses to anything on the list above.
- **Verifying the dialog frame and the settings sheet in a real world.** Not a spec — it is one
  screenshot from anyone with a licence, and 08 removes the part of it that matters most.
