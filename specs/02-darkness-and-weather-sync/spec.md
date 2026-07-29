# 02 — Scene darkness, working weather sync, SmallTime replacement

## What & why

The first build runs in a real world. Three things came out of testing it:

1. **Changing the weather does nothing to the canvas.** Two independent causes, both confirmed by
   reading the code and the Foundry API docs (below).
2. **Scene darkness should follow the clock**, the way SmallTime's Darkness Control does — dark at
   night, light by day, tracking the seasonal sunrise and sunset we already compute.
3. **SmallTime should become unnecessary.** Taking over darkness control is the last thing it does
   that we do not. Its sun/moon scrubber widget is explicitly out of scope for this round.

Plus one cosmetic change: the buttons should not react on hover.

## The weather bug

Two defects stack, and either alone is enough to produce "I change the weather and nothing happens".

**The dialog silently discards the form.** The override dialog is built with `DialogV2.prompt()`,
which *injects its own confirmation button* alongside the ones we pass. That is the stray `Confirm`
next to our `Save`. It submits the dialog without ever running our callback, so pressing it saves
nothing at all — and it sits where the primary button normally does. `DialogV2.wait()` renders only
the buttons given to it.

**Scene sync is off by default and fails silently.** `applySceneWeather` returns early when the
setting is off, when the client is not the active GM, when the scene has opted out, and when the
scene's weather looks hand-authored. Every one of those returns without a word, so an enabled
feature and a disabled one look identical from the outside.

## Decisions

| Question | Decision |
| --- | --- |
| Darkness control switch | **Per-scene only** — a checkbox in scene configuration, no global switch |
| Darkness curve | Smooth twilight ramp between configurable night and day levels |
| SmallTime | Replace it for darkness; the sun/moon widget is deferred to a later version |
| Weather sync default | **On**, since off-by-default is half of why it appeared broken |

## Acceptance criteria

1. The weather dialog shows exactly two buttons — `Save`, and `Use generated weather` when the day
   is overridden. No stray `Confirm`.
2. Choosing a condition and saving changes the bar **and** the scene's Weather Effect, with no
   settings changed first.
3. When weather sync declines to act, it says why in the console — which guard, which scene.
4. A scene with darkness control enabled is fully dark at midnight and fully light at midday.
5. Darkness ramps smoothly through sunrise and sunset rather than snapping.
6. The ramp tracks the season: a midwinter evening darkens hours earlier than a midsummer one.
7. Scenes without the checkbox are never written to.
8. A scene with **Darkness Level Lock** set is never written to, checkbox or not.
9. With SmallTime uninstalled, darkness still tracks the clock.
10. Buttons no longer change appearance on hover.

## Edge cases

- **Three modules can drive darkness** — PF2e's `syncDarkness`, SmallTime's Darkness Control, and
  ours. Two of them writing produces a visible fight. Detect and warn once rather than silently
  competing.
- **Write volume.** With the clock running, darkness would otherwise be recomputed every tick and
  written to the Scene document each time. It must only write when the value actually moves.
- **Polar latitudes** — at 80° the sun may not rise at all; the curve must stay defined.
- **Scene switching** — darkness applies to the scene being viewed, and must catch up on
  `canvasReady`.
- **Non-GM clients** must never write; they see the result through the document update.

## Known unknown

The exact schema path for scene darkness is **not confirmed**. v13 deprecated `Scene#darkness` in
favour of `Scene#darknessLevel`, and v14's `BaseScene` schema has no top-level darkness field —
it lives under `environment`. Rather than guess, the code detects which path the live Scene document
exposes and logs the one it chose. If neither is found it disables itself with a warning instead of
writing to a field that does not exist.

## Out of scope

- SmallTime's draggable sun/moon time scrubber. Wanted, but for the definitive UI later.
- Any change to how time itself is calculated.

## Notes
