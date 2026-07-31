# 13 — Per-season light and temperature (pre-spec)

Not a spec yet. This one is a disagreement with the reference rather than a gap.

## The disagreement

The reference stores four values **per season**: `sunrise`, `sunset`, `minTemp`, `maxTemp`.

We compute all four. Sunrise and sunset come from a solar model — latitude and day of year — and
temperature from a climate profile shaped by a seasonal curve and seeded per day.

Ours is why Tarlan's month lengths could be tuned until its four season boundaries landed on the
solstices and equinoxes the model actually computes, and why extreme latitudes produce polar day and
polar night instead of nonsense. A test asserts that alignment.

Theirs is far easier to author. A GM who wants "the sun sets at six in winter" states it, and does not
have to discover that latitude is the dial.

## The option that is neither

**Let a calendar override where it states a value, and compute where it does not.**

Tarlan and Golarion state nothing and keep behaving as they do now. A homebrew world can pin sunset in
winter, or declare a fixed twelve-hour day, or give a season a temperature range that has nothing to do
with any latitude. The solar model stays the default rather than the only answer.

This also makes 12's wizard honest: it can offer those fields, and leaving them empty means "work it
out".

## To decide before the spec

1. **Does an override silence the latitude setting, or coexist with it?** Half-overridden — sunset stated,
   sunrise computed — is either a useful mixture or an incoherent day.
2. **Per season, or per month?** Seasons are four; months are twelve and give a smoother year. The
   reference says seasons.
3. **What overrides mean for scene darkness.** The darkness curve is driven by the same sunrise and
   sunset, so an override moves the lighting too. That is probably wanted, and it should be said.
4. **Temperature overrides and the daily variance.** Our generator varies a day around a seasonal
   average. A stated min and max could be the envelope the variance works inside, or could replace it.

## Touches

`src/time/calendar.ts` (new optional fields), `src/time/sun.ts`, `src/weather/generator.ts`,
`src/scene/darkness-curve.ts`, and the two bundled calendar files if we choose to state anything in them.

## Size and dependencies

Medium. Nothing blocks it. Worth having the argument early because it may end in a deliberate "no".
