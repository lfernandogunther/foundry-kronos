# 03 — Tasks

One commit per item. Tasks 1–3 are one working whole: the build only goes green again at the end of
3, so they land in quick succession.

- [x] **1. Calendar definitions** — `CalendarDefinition` in `src/time/calendar.ts`: months as
      `{name, days?}`, season boundaries, festivals, epoch. Validation normalises the legacy
      `months: string[]` shape to "Gregorian structure", rejects anything else, and no longer
      hardcodes 12 months / 7 weekdays for custom calendars
- [x] **2. Reckoning engine** — `src/time/reckoning.ts`, pure and definition-driven: `worldTime` ↔
      year/month/day/weekday/day-of-year, month and year steps, start-of-day. Floor division
      throughout, epoch taken as a resolved `worldTime`. Tests per the plan's list
- [x] **3. Route the module through the calendar** — `src/time/clock.ts` facade picking the backend
      and resolving `epoch.on` through `worldCreatedOn` (lazily, and warning when that read falls
      back); `getWorldDate` / `dateKeyOf` move there, the key gains the calendar name, and
      `module.ts`, `darkness.ts`, `weather/state.ts` and `calendar-bar.ts` import from it.
      `pf2e-clock.ts` keeps only the PF2e reads
- [x] **4. Steps and jumps** — month and year steps and `secondsUntilTimeOfDay` resolve against the
      active calendar rather than `addMonthsUtc` and UTC midnight. Landed with task 3: dropping the
      Gregorian-only `utcMs` from `WorldDate` left the call sites no other option
- [ ] **5. Seasons from the definition** — boundaries out of the `season.ts` constant and into the
      calendar files; `summerness` takes the calendar's year length. Golarion's current values
      written into its file so its behaviour is unchanged
- [ ] **6. The Tarlan calendar** — `data/calendars/tarlan.json`: the twelve months and their
      lengths, the seven weekdays, the four day-20 boundaries, the three festivals, era `TR`, and
      the epoch anchored via `epoch.on`. A test asserting the year is 365 days and no month falls
      outside 30–31
- [ ] **7. Festivals on the bar** — shown when the day carries one; styling in `kronos.css`
- [ ] **8. Calendar selection** — a setting listing the bundled calendars alongside the existing
      file path, with a re-render on change
- [ ] **9. PF2e divergence** — skip `verifyAgainstSystemClock` for non-Gregorian calendars, and warn
      once that the system World Clock will show a different date and time
- [ ] **10. Docs and strings** — the README's *Custom calendars* section rewritten (it currently
      states month lengths cannot be redefined), Tarlan documented, `lang/en.json` filled in

## Open

One value, not blocking: `epoch.on` in `tarlan.json` ships as `2025-01-01T00:00:00Z` until the live
world's current date and hour are known. The code path is identical; correcting it is one line.
