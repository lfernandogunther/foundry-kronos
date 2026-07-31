# 10 — Day notes (pre-spec)

Not a spec yet.

## What

Text attached to an in-world day: written by a GM, shown in the month grid on the days that carry one,
and probably on the bar for today. The reference keeps them in the calendar object and edits them in a
small modal.

## The whole question is storage

This is the first feature that stores something a person wrote, and that makes where it goes the spec.

| Option | For | Against |
| --- | --- | --- |
| A world setting | Simple, works today, one place | One JSON blob: every note rewrites all of them, and two GMs writing at once lose one |
| Flags on the world or a scene | Same shape as above | No better, and stranger to find |
| **Journal entries** | Foundry's own place for prose. Searchable, permissioned, linkable from anywhere, and a GM can write one without the panel | Much more work, and it needs a convention for which journal and how a date is recorded on it |

Journal entries are the more Foundry-native answer and the more expensive one. Worth deciding before a
line is written rather than migrating later.

## To decide before the spec

1. **Storage**, per above.
2. **Who writes and who reads.** GM-only writing is the obvious start. Whether players see notes at all
   is a different question, and if they do, "GM notes" and "notes the table can read" are two features.
3. **Notes and the calendar they were written under.** `dayKey` namespaces itself by calendar name for
   calendars with their own months — `Tarlan:1000-01-01` — precisely so weather cannot leak between
   them. Notes keyed the same way would *vanish* when a world switches calendar, which is either correct
   or a nasty surprise. Notes keyed by the underlying instant instead would follow the world across a
   calendar change. Both are defensible; silence is not.
4. **Does today's note appear on the bar?** It competes with the festival tag for the same space, and at
   small there is none.

## Touches

Storage layer (new), the month grid from 09, the panel, a modal, `lang/en.json`.

## Size and dependencies

Medium, and larger if journals win. Wants 09 first for somewhere to show.
