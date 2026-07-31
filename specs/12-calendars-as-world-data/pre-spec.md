# 12 — Calendars as world data, and the wizard (pre-spec)

Not a spec yet, and the one to be most careful with.

## What

The reference keeps a library of calendars the user creates and edits through a five-step wizard, stored
in the world, switchable from a dropdown on the panel. Steps: name and year, weekdays, months and their
lengths, seasons, and sunrise/sunset per season.

## Why this is not a UI feature

Today a calendar is a **file** — bundled, or a path in a setting — parsed read-only, and switching
requires a reload. Moving it into world data changes where the truth lives, and that brings in problems
the reference does not have because a prototype has no history:

1. **Editing the calendar a running world is already reckoning in.** Change a month from 30 days to 31
   and every date after it moves. With our epoch anchoring, the whole timeline shifts relative to the
   instant it is pinned to. A session's notes, a scheduled festival and the weather for every day are all
   keyed off dates that just changed underneath them.
2. **Two GMs editing.** World data is shared and writes race. A half-saved calendar is a world that
   cannot render a date.
3. **Switching without a reload.** This is the prerequisite the panel's missing calendar dropdown is
   waiting on, and it means every cached reckoning has to be invalidated on demand. The cache in
   `clock.ts` keys on calendar identity, which helps.
4. **Validation is no longer a build-time concern.** A malformed *file* is rejected in favour of the
   calendar in force and logged. A malformed *edit* has to be rejected before it is saved, with the
   field named, in a form someone is looking at.

## To decide before the spec

1. **May the active calendar be edited at all?** Forbidding it is defensible and cheap: copy, edit the
   copy, switch. Allowing it needs an answer to what happens to every date that moves.
2. **Do the bundled calendars stay files?** They should — a broken world should still have Golarion.
   So there are two tiers, and the library is the mutable one.
3. **Does the wizard have to be a wizard?** The reference offers a toggle between wizard and one long
   form. The long form is much less work and probably nicer for editing an existing calendar.
4. **Migration.** Anyone using the *Calendar file* setting today has to keep working.

## Size and dependencies

Large — the biggest thing left, and the largest piece of UI in the module. Wants 11 first for the
serialisation, and wants 09 and 10 first so we know what the rest of the interface looks like before
adding the most complicated part of it.

**This is also where "follow the reference exactly" is most likely to be the wrong instruction.**
