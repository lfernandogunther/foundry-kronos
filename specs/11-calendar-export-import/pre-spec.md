# 11 — Export and import a calendar (pre-spec)

Not a spec yet.

## What

The reference's `json-tools-bar`: export every calendar, export one, and import from a file — done from
the interface instead of by editing a path setting.

Most of this exists already. `parseCalendar` reads the format, rejects a malformed file field by field,
and the two bundled calendars are written in it. The *Calendar file* setting already loads one from a
path. What is missing is doing any of it without touching the filesystem by hand.

## The constraint that shapes it

**A browser can offer a download but cannot write to the server.** Export is easy — a blob and an anchor,
which is what the reference does. Import is not: to put a file where the *Calendar file* setting could
find it, the module would have to upload it through Foundry's own file API, with the permissions that
implies.

So import has two shapes:

- **Store the imported JSON in a world setting.** No filesystem, works for every user, and it is the
  first step towards calendars living in world data — which is what 12 is.
- **Upload the file and point the setting at it.** Keeps calendars as files, needs upload permission,
  and fails for a player-GM on a hosted server without it.

The first is simpler and points where we are going anyway. Choosing it here is choosing part of 12.

## To decide before the spec

1. **Import destination**, per above.
2. **What "export the active calendar" means when it was not a file.** With Golarion selected we do not
   export our own definition — we synthesise it from `CONFIG.PF2E.worldClock`, localised. Exporting that
   is exporting a snapshot of the installed system's names, which is useful and slightly surprising.
3. **Whether importing switches to the imported calendar.** Switching currently needs a reload.

## Touches

`src/time/calendar.ts` (serialisation out, which is new), a small app or an addition to the settings menu,
`lang/en.json`.

## Size and dependencies

Small. Nothing blocks it, and doing it before 12 settles the format question while it is still cheap.
