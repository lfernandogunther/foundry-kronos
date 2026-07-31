# Candidate specs

What is left, where it comes from, and in what order it makes sense. Nothing here is agreed — this is
the list to argue with, one at a time. Numbers are the spec folder each would take if we start it.

Rounds 01–06 are done and released as 0.4.0.

## Where the work comes from

Two sources, and they should not be confused.

**The design reference** (`docs/foundy-kronos-design-reference.html`) is a working prototype of the whole
thing. Its panel is built. What is not built is everything behind two of its buttons: the month grid and
the settings modal — and the settings modal is really three features stacked (a calendar library, a
creation wizard, and import/export).

**Our own debt** is smaller but real: one language, a control path that has never been seen working, and
a weather model that disagrees with the reference's.

## The list

| # | Spec | From | Size | Blocked by |
| --- | --- | --- | --- | --- |
| 07 | Brazilian Portuguese | ours | S | — |
| 08 | Size and collapse from the panel | ours | S | — |
| 09 | The month grid | design | M | — |
| 10 | Day notes | design | M | 09 for where they show |
| 11 | Export and import a calendar | design | S | — |
| 12 | Calendars as world data, and the wizard | design | **L** | 11 |
| 13 | Per-season light and temperature | design | M | — |
| 14 | Step modes as pairs | design | S | — |
| 15 | The inline weather picker | design | S | — |
| 16 | Round and encounter awareness | design | S | — |

---

## 07 — Brazilian Portuguese

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

## 08 — Size and collapse from the panel

The size chosen in round 06 is only reachable through the settings sheet, and the panel's own gear —
the shortcut to it — is one of the two things that has never been verified in a running Foundry. So the
one control that fixes "everything is too big" sits behind the one path we are least sure of.

Putting it on the panel removes that dependency. Options to discuss: cycling the size from the collapse
tab (double-click? a second tab?), a small control in the row, or a context menu on the panel
background. The last is probably right — it is invisible until wanted and costs no width.

Small, and it makes the 0.4.0 feature actually discoverable.

## 09 — The month grid

The reference's `calendar_month` button, which we deliberately do not render. A month at a time: weekday
headers, one cell per day, today highlighted, arrows to move month by month, and clicking a day goes
there.

We have everything needed except one arithmetic: **the world time a given year/month/day begins at**.
`reckoning.ts` converts one way; this needs the inverse. That is a contained, testable addition and the
Gregorian path needs its own version of it.

Worth deciding early: does clicking a day *move world time* or only *preview* the month? The reference
moves. Moving a party three weeks forward by misclicking is a real risk, and the grid is the first place
in this module where a click can move time by a lot.

## 10 — Day notes

Per-day text, shown in the grid and probably on the bar for today. The reference stores them in the
calendar object.

This is the first feature that stores content someone wrote, which makes storage the whole question:

- a world setting — simple, but it is one JSON blob and every note write rewrites all of them
- flags on the Scene or on the world — same shape, no better
- **Journal entries** — Foundry's own place for prose. Searchable, permissioned, linkable, and a GM can
  write one without the panel. Much more Foundry-native, and much more work.

Not a small decision, and it is worth taking before anything is written rather than after.

## 11 — Export and import a calendar

The reference's `json-tools-bar`: export all, export one, import a file. We already have the format —
`parseCalendar` reads it and the two bundled files are written in it — and the *Calendar file* setting
already loads one from a path. What is missing is doing it from the interface.

Cheap and independently useful: it makes a hand-written calendar shareable without a file path, and it
settles the serialisation before 12 needs it.

## 12 — Calendars as world data, and the wizard

The big one, and the one to be most careful about.

Today a calendar is a **file**: bundled, or a path in a setting, parsed read-only, and switching requires
a reload. The reference has a **library** of calendars the user creates and edits in a five-step wizard,
stored in the world, switchable from a dropdown on the panel.

That is not a UI feature, it is a change of where the truth lives. It brings in:

- calendars stored in world data, so two GMs can edit them and a bad edit is a broken world, not a
  broken file
- switching without a reload — today the reload is why the panel has no calendar dropdown
- editing the calendar a running world is *already reckoning in*: change a month's length and every
  date after it moves. The reference does not think about this. We have to, because our epoch anchoring
  means the whole timeline shifts.
- the wizard itself, which is five forms and the largest piece of UI in the module

I would not start this until 09, 10 and 11 have settled what the interface looks like. It is also the
one where "follow the reference exactly" is most likely to be the wrong instruction.

## 13 — Per-season light and temperature

A genuine disagreement with the reference, not a missing feature.

The reference stores `sunrise`, `sunset`, `minTemp` and `maxTemp` **per season**. We compute sunrise and
sunset from latitude and the day of the year with a solar model, and temperature from a climate profile
shaped by a seasonal curve. Ours is why Tarlan's month lengths could be tuned so its solstices land on
the real ones, and why the Arctic behaves.

Adopting the reference's model would make a calendar author's job easier and the world less physical.
The interesting option is neither: **let a calendar override the computed values where it states them**,
and compute where it does not. That keeps Tarlan honest and lets someone build a world with a fixed
six-hour day if they want one.

Worth discussing precisely because the reference may simply be wrong here.

## 14 — Step modes as pairs

Ours is a unit and a multiplier: pick "minute", the inner arrows move one and the outer ten. The
reference pairs them — `Min / Horas`, `Rounds / Min`, `Dias / Meses`, `Meses / Anos` — so one choice sets
both.

Theirs is fewer decisions and reads better on a narrow panel. Ours is more flexible and already
configurable. Small either way; mostly a question of which we think is nicer to use, and it interacts
with the small size, where the select is one of the widest things in the row.

## 15 — The inline weather picker

The reference's dropdown on the weather block: eight conditions as icon rows plus "back to automatic".
We open a dialog instead, because the dialog also edits the two temperatures the picker cannot express.

Do this once the dialog's styling has actually been seen in a world — it is the same surface, and there
is no point building the second thing before knowing whether the first one looks right.

## 16 — Round and encounter awareness

The reference prints `00s (Round 1)` under the clock. We dropped it: a round counter derived from the
wall clock would contradict Foundry's encounter tracker, which owns the real number.

The version that is not wrong: when an encounter is running, show *its* round, from
`game.combats.active`. That is information the reference could not have and a GM actually wants, and the
clock already stops for combat by default, so the two ideas already meet.

---

## What is not on the list, and why

- **The calendar dropdown on the panel.** It needs switching without a reload, which is part of 12. Not
  a spec of its own.
- **The `(Round 1)` text as the reference has it.** Superseded by 16.
- **Harness improvements** (on-page size controls, a stubbed settings sheet). Useful, but it is tooling
  for us and loses to anything on the list above.
- **Verifying the dialog frame and the settings sheet in a real world.** Not a spec — it is one
  screenshot from anyone with a licence, and 08 removes the part of it that matters most.
