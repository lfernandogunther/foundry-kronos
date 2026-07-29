# 03 — The Tarlan calendar, and calendars with their own month lengths

## What & why

Tarlan is a homebrew setting with its own twelve months and seven weekdays, and no month in it may
be shorter than 30 days or longer than 31. That single constraint is what makes this more than a
rename.

Everything the module displays today is Gregorian underneath. `describeUtcMs` reads year, month and
day straight off a `Date`, because reproducing PF2e's own formula — world creation timestamp plus
`worldTime` seconds, read in UTC — is what keeps our bar and the system's World Clock from ever
disagreeing. The cost of that guarantee is the one the README already states: month *lengths* come
from the Gregorian structure and cannot be redefined. February has 28 days, and no amount of
renaming changes that.

So this round replaces the date layer with a calendar engine that carries its own month lengths, and
ships Tarlan as the first calendar that uses one. Golarion keeps the Gregorian, PF2e-synced
behaviour it has now. Which of the two is in force is a setting, so a different campaign or a
different system can be pointed at a different calendar file without touching code.

## Decisions

| Question | Decision |
| --- | --- |
| Agreement with the PF2e World Clock | **Given up, for custom calendars only.** Golarion stays synced |
| Year length | **365 days, always.** No leap rule — a 32-day month is not allowed, and a day belonging to no month is worse |
| Month lengths | 5 months of 31, 7 of 30. See the table |
| Season boundaries | Day 20 of the four turning months, carried in the calendar file |
| The three sacred months | 31 days **and** a named festival shown on the bar |
| Enudar | Month 1, the January-equivalent, in winter. "Renewal" is the turn of the year, not spring |
| Arkhane | Stays month 6. Its "longer nights" is lore, not mechanics — see below |
| Epoch | **Anchored to the present**: the date being played today becomes Enudar 1, 1000 TR, at the same hour and the same weekday |
| Engine shape | Any number of months and weekdays. The 30–31 rule is Tarlan's, not the engine's |

## The calendar

Twelve months, 365 days. `31 30 31 30 31 30 31 30 30 30 30 31`.

| # | Month | Days | Day of year | God / origin | Season |
| --- | --- | --- | --- | --- | --- |
| 1 | **Enudar** | **31** | 1–31 | Enudrani, god of the elves | winter |
| 2 | Halveris | 30 | 32–61 | Halveta, goddess of the ocean | winter |
| 3 | Zherial | **31** | 62–92 | Zherion, god of chaos | winter → **spring on the 20th** |
| 4 | Fideril | 30 | 93–122 | Fiderin, the state of the arcane schools | spring |
| 5 | Krigvaldar | **31** | 123–153 | Krigvald, god of war | spring |
| 6 | Arkhane | 30 | 154–183 | Arhan-Khai, god of night and rogues | spring → **summer on the 20th** |
| 7 | **Ellariel** | **31** | 184–214 | Ellaryn, the elder god of the elves | summer |
| 8 | Lornathis | 30 | 215–244 | Lorna, goddess of the underworld | summer |
| 9 | Tierbrak | 30 | 245–274 | Tierlöbock, god of monsters | summer → **autumn on the 20th** |
| 10 | Elyndrel | 30 | 275–304 | Elyndra, goddess of knowledge | autumn |
| 11 | Sovinaris | 30 | 305–334 | Sovindar, god of magic | autumn |
| 12 | **Zyullian** | **31** | 335–365 | Z'yull, god of justice | autumn → **winter on the 20th** |

Weekdays, Monday-equivalent first, matching the order the module already expects:
**Verdrag · Eldora · Thalorin · Drusten · Mithralis · Sylvain · Solara**.

### Why the seasons turn on the 20th

They turn on the day the sun turns, and that is not a coincidence — the month lengths were chosen
to make it true.

The module's solar model ([sun.ts](../../src/time/sun.ts)) puts the spring equinox on day 81 of a
365-day year and swings a sinusoid from there. Its own turning points therefore fall on days 81,
172.25, 263.5 and 354.75. The four boundaries above land on days 81, 173, 264 and 354 — each within
a single day of the moment the daylight actually turns.

That is what "the seasons change when night falls" asks for, taken literally: the label on the bar
changes on the day the length of the day changes direction. And because both come from the same
anchor, `sun.ts` needs no change at all.

The consequence a GM will feel, at the default latitude of 48°:

| | Sunrise | Sunset | Daylight |
| --- | --- | --- | --- |
| Zyullian 20 (midwinter) | 07:55 | **16:05** | 8h 10m |
| Zherial 20 / Tierbrak 20 (equinox) | 06:00 | 18:00 | 12h 00m |
| Arkhane 20 (midsummer) | 04:05 | **19:55** | 15h 50m |

Nearly four hours of swing in when it gets dark, and scene darkness already follows sunset rather
than a fixed hour ([darkness-curve.ts](../../src/scene/darkness-curve.ts)), so midwinter dusk
arrives in the late afternoon on its own.

### The three sacred months

Enudar, Ellariel and Zyullian are the months of Enudrani, Ellaryn and Z'yull. They are among the
five 31-day months, and each carries a festival the bar names on the day:

| Date | Festival | Why there |
| --- | --- | --- |
| Enudar 1 | **Enudrani's Renewal** | The turn of the year |
| Ellariel 15 | **Ellaryn's Vigil** | Mid-month in the month of legacy and remembrance |
| Zyullian 20 | **Z'yull's Reckoning** | The winter solstice — the longest night, judged as the year closes |

Festival names are data, not code. Rename them in the calendar file.

### Arkhane's nights

Arhan-Khai's month is described as a time of longer nights, and it carries the summer solstice —
the shortest nights of the year. That tension is deliberate and stays: **lore, not mechanics.**
Nothing in the module reads a month's description, so this changes no behaviour and no output.

The reading that holds it together: summer grants Arhan-Khai only a few hours of true dark, which is
exactly why the secret celebrations of Arkhane are the ones worth attending. The alternatives were to
move the month or to invert the seasonal wheel, and both cost more than the sentence is worth.

### The epoch

The whole point of anchoring to the present is that switching a live world to Tarlan should change
the *names* on the bar and nothing else — not the hour, not the weekday, not where in the year the
party is standing.

The anchor cannot be a raw `worldTime` number, because nobody can read one off the bar. So it is
declared in Gregorian terms and resolved at load:

```json
"epoch": { "on": "2025-04-14T21:30:00Z", "year": 1000, "month": 1, "day": 1 }
```

`on` is that instant put through PF2e's own `worldCreatedOn` to get a `worldTime`, which becomes the
zero point. Its time of day carries over, so the clock keeps reading 21:30. Its weekday is computed
from the same instant, so Tarlan's weekday cycle lands on the same day of the week the bar shows now.

A GM re-anchoring later needs only the date and hour their bar displays — Absalom Reckoning years are
Gregorian plus 2700 and the month and day are identical, so `14 Gozran 4725 AR` is
`2025-04-14`. If `on` is absent the epoch falls back to `worldTime` 0, midnight, first weekday.

## Acceptance criteria

1. With Tarlan selected, the bar reads `❄ 20 Zyullian <year> TR` and the month names are Tarlan's.
2. Stepping by **day** through a month boundary lands on day 1 of the next month, and every month
   ends on 30 or 31 — never 28, 29 or 32, in any year.
3. Stepping by **month** from Enudar 31 lands on Halveris 30, not on Zherial 1.
4. Stepping by **year** from any date returns the same month and day.
5. Weekdays advance one per day and cycle through all seven in order, with no repeat or skip at
   month or year boundaries.
6. Day of year runs 1 on Enudar 1 to 365 on Zyullian 31, in every year.
7. The season shown changes on day 20 of Zherial, Arkhane, Tierbrak and Zyullian, and on no other
   day.
8. At latitude 48, sunset on Zyullian 20 is near 16:05 and on Arkhane 20 near 19:55; the darkness
   ramp follows both.
9. Enudar 1, Ellariel 15 and Zyullian 20 show their festival name on the bar. Other days show none.
10. Switching a live world from Golarion to Tarlan leaves the hour, the minute and the day of the
    week exactly as they were. Only the month name, the weekday name and the year change.
11. Selecting Golarion instead restores today's behaviour exactly: Gregorian month lengths, leap
    years, and agreement with the PF2e World Clock.
12. With a custom calendar active, the module does **not** warn about disagreeing with the system
    World Clock — the disagreement is the point — and says once, clearly, that the two will differ.
13. A calendar file that is malformed leaves the previous calendar in force and logs why.
14. Existing worlds that never touch the setting are unaffected — including the weather they
    generate, which is seeded from the day key and must keep the key it had.

## Edge cases

- **The PF2e World Clock is still installed and still visible.** It will show a different date and a
  different time of day from ours, because it is Gregorian and anchored to the world creation
  timestamp while Tarlan is anchored to its own epoch. Nothing can reconcile them; the module must
  say so once rather than let a GM discover it mid-session.
- **The epoch depends on PF2e being readable.** `epoch.on` is resolved through `worldCreatedOn`, and
  that read already has a documented fallback to the Unix epoch when PF2e is absent or its setting is
  unreadable. A custom calendar inherits that fallback, so the anchor silently lands somewhere else
  when it fires. It must warn, not just shrug.
- **Where the day starts.** Preserving the hour is the same thing as saying Tarlan's time of day
  equals UTC's, so Tarlan's days begin at UTC midnight — the boundary every existing caller already
  assumes. That is a property of this anchor, not of the engine: an epoch that shifted the hour would
  move the boundary, and then the weather key, the darkness curve's minute-of-day and the time-of-day
  jump buttons would each have to be told about it or they would disagree for part of every day. The
  engine therefore owns start-of-day rather than leaving `Date.UTC` inlined at the call sites, even
  though for Tarlan the two currently agree.
- **Negative `worldTime`.** Foundry permits it. Day and weekday arithmetic must floor rather than
  truncate, or dates before the epoch land a day off and the weekday cycle inverts.
- **Switching calendars in a live world.** `worldTime` is never rewritten, so nothing is lost — the
  same instant is simply labelled differently. It must not throw, and the bar must re-render.
- **The day key is a weather seed, not just an identifier.** `generateDailyWeather` hashes it, so its
  *shape* is load-bearing: prefixing every key with the calendar's name would have rerolled the
  weather of every day in every existing Golarion world, not merely orphaned the one override a GM had
  saved. That is a bigger change than this round is entitled to make, and it was very nearly shipped.

  So only calendars with months of their own name themselves in the key. Every calendar on the
  Gregorian timeline keeps the exact key it produced before — the underlying Gregorian year, padded,
  unprefixed — because they all agree on which day an instant is and should therefore agree on its
  weather. Renaming Golarion's months or changing its era does not disturb it either.
- **Weather and darkness read `dayOfYear` and days-in-year.** Both come from the active calendar
  now. A calendar whose year is not 365 days long must still produce a sane summer/winter curve.
- **A legacy calendar file.** The README tells users to copy `golarion-ar.json`, whose `months` is
  an array of strings. Those files must keep loading, and keep meaning "Gregorian structure".

## Out of scope

- Any change to how `worldTime` itself advances, or to the real-time clock.
- Moon phases, and any festival mechanic beyond showing the name.
- A UI for authoring calendars. The file is the interface.
- Localising month or festival names. They are proper nouns and stay literal in the data file.

## Needed input

One value, and only for task 6: **the date and hour the bar shows in the live world**, which becomes
`epoch.on`. Until it arrives the file ships `2025-01-01T00:00:00Z` as a placeholder — the code path is
identical either way, so nothing is blocked, and correcting it later is one line in
`data/calendars/tarlan.json`.

The era ships as `TR` and the anchor year as `1000`. Both are also one-line edits.

## Notes
