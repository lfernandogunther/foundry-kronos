# 03 — Plan

## The shape of the change

One seam already exists and everything hangs off it. `WorldDate` is the only description of "what
time is it" that the rest of the module consumes — the bar, scene darkness, the weather state and
`module.ts` all take it and never touch a `Date` themselves. Two smaller seams sit beside it:
`seasonOf(month, day)` and `summerness(dayOfYear, daysInYear)`.

So the work is to put a calendar behind those three, not to rewrite the module.

```
                       ┌─ gregorian backend ──── Date + PF2e worldCreatedOn   (Golarion, synced)
worldTime ──▶ reckon ──┤
                       └─ fixed-length backend ── month lengths from the file  (Tarlan)
                                    │
                                    ▼
                               WorldDate ──▶ bar · darkness · weather · steps
```

Which backend runs is decided by the shape of the active calendar file: month entries carrying a
day count select the fixed-length one, bare strings select Gregorian. That keeps every calendar
file that exists today working and meaning exactly what it means today.

## Files

| File | Change |
| --- | --- |
| `src/time/calendar.ts` | `CalendarDefinition` replaces `CalendarLabels`: months as `{name, days?}`, season boundaries, festivals, epoch. Validation accepts the legacy string-array shape and normalises it |
| `src/time/reckoning.ts` | **New.** Fixed-length arithmetic: `worldTime` ↔ year/month/day/weekday/day-of-year, month and year steps, start-of-day. Pure, no Foundry globals — the epoch arrives as a resolved `worldTime` argument |
| `src/time/gregorian.ts` | Unchanged. It is the Gregorian backend's arithmetic and stays as it is |
| `src/time/sun.ts` | **Unchanged.** Tarlan's season anchors were chosen to sit on this model's own turning points, so there is nothing to generalise |
| `src/time/pf2e-clock.ts` | Keeps the PF2e-specific reads. `describeUtcMs` becomes the Gregorian backend's `describe` |
| `src/time/clock.ts` | **New.** The facade the rest of the module imports: `getWorldDate`, `dateKeyOf`, `startOfDay`, backend selection, and resolving `epoch.on` through `worldCreatedOn` |
| `src/time/season.ts` | `seasonOf` takes the active calendar's boundaries instead of a module constant. Icons unchanged |
| `src/time/units.ts` | Month and year steps, and `secondsUntilTimeOfDay`, go through the calendar instead of `addMonthsUtc` and UTC midnight |
| `src/weather/state.ts` | Days-in-year and the season come from the calendar, not from `gregorian.ts` |
| `src/apps/calendar-bar.ts` | Imports move to `clock.ts`; renders the festival when the day has one |
| `src/module.ts` | Imports move to `clock.ts`; the clock-agreement check runs only for the Gregorian backend |
| `src/settings.ts` | Calendar selection: the bundled calendars by name, plus the existing file path |
| `data/calendars/tarlan.json` | **New.** The calendar from the spec |
| `styles/kronos.css`, `lang/en.json`, `README.md` | Festival styling, new strings, the custom-calendar section rewritten |

## Key decisions

**The facade is a new file, not a bigger `pf2e-clock.ts`.** That file's docstring says it is the
only file that touches PF2e internals, and that is worth keeping true. Backend selection is not a
PF2e concern.

**`reckoning.ts` is pure and takes the definition as an argument.** Everything interesting is
arithmetic on month lengths, and it should be testable without a Foundry global or a fake `Date`.
The active-calendar lookup lives in the facade.

**Floor division everywhere.** `Math.floor(worldTime / 86400)` and a `((n % 7) + 7) % 7` weekday,
not `%` alone. Negative `worldTime` is legal in Foundry and truncation would put pre-epoch dates a
day out.

**Season boundaries move into the calendar file.** They are `{month, day, season}` triples today,
already in exactly the right shape — they just live in a module constant instead of the data. The
Gregorian file gets its current values written into it, so nothing changes for Golarion.

**No leap machinery.** The fixed-length backend has no leap rule and the Gregorian one handles leap
years inside `Date` as it already does. Nothing needs a concept of "leap" at the definition level.

**The epoch is declared in Gregorian terms, resolved once, cached.** `epoch.on` is an ISO instant, so
`reckoning.ts` never has to know about `worldCreatedOn` — the facade turns it into a `worldTime` and
hands that in. It resolves lazily rather than at load, because `worldCreatedOn` is a PF2e setting and
settings are not readable before `init`. Resolution failure is the same failure `worldCreatedOn`
already documents; it warns rather than substituting an anchor silently.

**Start-of-day belongs to the engine, not the call sites.** For Tarlan's anchor it happens to be UTC
midnight, so `secondsUntilTimeOfDay` would keep working untouched — but only by coincidence of this
epoch, and a wrong jump button is invisible on the bar. The function takes the boundary from the
calendar so the coincidence stops being load-bearing.

**`dateKeyOf` gains the calendar name.** `tarlan:1000-01-20`. Without it, two calendars produce the
same key for different days, and the weather a GM overrode in one would surface in the other.

## Testing

`reckoning.ts` is where the risk is, and it is pure, so it takes the weight:

- Round-trip every day of a year: `describe(compose(y, m, d))` returns the same triple.
- Month lengths: sweep all 365 days and assert the day never exceeds the month's length, and that
  each month's last day is followed by day 1 of the next.
- Weekday: 400 consecutive days advance by exactly one index each, cycling.
- Negative `worldTime`: the day before the epoch is the epoch's month/day minus one, and its
  weekday is the epoch weekday minus one.
- The epoch itself: the anchor instant reports the anchor date, with its hour and minute intact and
  its weekday equal to the weekday of the Gregorian instant it was declared from.
- Steps: month step clamps (Enudar 31 + 1 month → Halveris 30); year step is identity for
  month/day; both are exact multiples of a day.
- Seasons: the boundary days flip and the day before does not, for both calendars.

For the parts that need Foundry, the existing pattern in `tests/` covers it — the current
`pf2e-clock.test.ts` calls `describeUtcMs` directly with labels passed in, and the Gregorian backend
keeps that signature so those tests keep passing unchanged. That is the regression guard for
"Golarion still behaves exactly as it did".

The full check is `npm run check` (typecheck, tests, build).

## Risks

- **`secondsUntilTimeOfDay` is the subtle one** — and building it settled the question. Because the
  anchor takes its time of day *from* the declared instant, a calendar's time of day is always equal
  to UTC's, so the day boundary is always UTC midnight no matter what `epoch.on` says. No epoch
  reachable through the file can shift it. The engine still handles a shifted anchor and is tested
  for one directly, but the facade cannot produce it, so there is no hidden case waiting for whoever
  re-anchors later.
- **The manifest/version tests are unrelated but strict.** `tests/manifest.test.ts` fails if the
  three version strings disagree; nothing here should touch them.
- **Ordering.** Tasks 1–3 must land together to keep the build green, so task 3 is where the
  behaviour actually flips. Everything after it is additive.
