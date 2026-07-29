# 02 — Technical plan

## Files

```
src/scene/darkness.ts        NEW — time of day -> darkness level, and the guarded write
src/scene/darkness-curve.ts  NEW — pure curve maths, unit tested
src/apps/weather-override.ts prompt() -> wait(); no injected button
src/weather/scene-sync.ts    robust scene resolution, reasoned diagnostics
src/apps/scene-config.ts     second checkbox for darkness control
src/settings.ts              night/day levels, twilight length, sync default
src/module.ts                wire darkness into updateWorldTime and canvasReady
styles/kronos.css      drop the hover rules
lang/en.json                 new strings
```

## The darkness curve

Pure, and the only part with real logic worth testing:

```
darkness(minuteOfDay) =
  day    when the sun is up beyond the twilight window
  night  when it is down beyond it
  smoothstep between the two across each twilight window
```

The window is centred on the sunrise and sunset already produced for that day and latitude, so
seasonal drift is inherited rather than modelled again — a midwinter dusk simply arrives earlier.
`smoothstep` rather than linear so the ends ease instead of cornering.

Polar days and nights fall out of the existing solar events: when the sun never rises the window
collapses and the whole day sits at one level.

## Writing darkness safely

Every write is a Scene document update broadcast to all clients, so the write path is guarded:

- **Active GM only.** Same rule as the ticker and weather.
- **Only when it moves.** Compare against the scene's current level and skip anything under a small
  epsilon. Through the day and night plateaus that means no writes at all; only the two twilight
  ramps produce any.
- **Only opted-in scenes**, via a per-scene flag set from a scene-config checkbox. There is no
  global switch by choice — interiors and caves outnumber outdoor scenes.
- **Never a locked scene.** Foundry's own *Darkness Level Lock* is an explicit instruction not to
  change it, and overriding that would be wrong regardless of our checkbox.
- **Animated**, by passing an animation duration on the update so the change eases in rather than
  stepping.

### Resolving the schema path

The write path is detected once, against a real Scene document, rather than assumed:

1. `environment.darknessLevel` if the document exposes an `environment` object,
2. otherwise the legacy top-level `darkness`,
3. otherwise disable the feature and warn — writing to a field that does not exist would fail
   silently, which is the exact class of bug this spec is fixing elsewhere.

The chosen path is logged once at startup so it is visible in the console.

## Conflict detection

At startup, and only for a GM, check for the other two things that drive darkness:

- PF2e's `worldClock.syncDarkness` setting,
- SmallTime's per-scene darkness control flag, if SmallTime is active.

If either is on while ours is, warn once naming the conflict. We do not silently disable ourselves
or switch theirs off — both would be surprising — but a fight between two writers must not be left
for the user to diagnose from behaviour alone.

## Fixing the weather path

**Dialog.** Swap `DialogV2.prompt()` for `DialogV2.wait()`. `prompt` injects a confirmation button
of its own; `wait` renders exactly the buttons passed. This is why `Confirm` appeared beside `Save`,
and why pressing it saved nothing.

**Default on.** `sceneWeatherSync` flips to `true`. It writes to Scene documents, which is why it
was opt-in, but the no-stomp guard and per-scene opt-out already cover the cases that argued for
caution — and shipping it off by default made a working feature look broken.

**Scene resolution.** `game.scenes.viewed` is not a reliable accessor across versions. Prefer
`canvas.scene`, which is unambiguously the scene on screen, then fall back to the collection.

**Diagnostics.** Each early return logs which guard stopped it and on which scene. A GM who saves a
weather override while sync is disabled gets a one-time notification rather than silence.

## Verification

Unit tests over `darkness-curve.ts`: night and day plateaus, the midpoint of each ramp, monotonic
across sunrise, defined under polar conditions, and identical output for identical input. Each guard
mutation-checked once.

In Foundry:

1. Weather dialog shows only our buttons; saving changes the bar and the canvas.
2. Enable darkness control on a scene, step an hour at a time from midnight to midnight, watch it
   ramp and plateau.
3. Compare a midwinter and a midsummer date at 18:00 — the winter one is dark, the summer one is not.
4. A scene without the checkbox, and a scene with Darkness Level Lock, both stay untouched.
5. Uninstall SmallTime; darkness still tracks.
6. Watch the console during a running clock: writes only during twilight, not on every tick.
