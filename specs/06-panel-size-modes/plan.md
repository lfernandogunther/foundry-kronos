# 06 — Plan

## The shape of the change

Almost all of it is the stylesheet. The panel's markup does not change: what a size does is set
different values for the same set of custom properties.

```
.kronos-wrapper                 ── every scaling value, at large        (the base)
.kronos-wrapper.kronos-size-medium ── the same names, 0.72 / 0.85 of them
.kronos-wrapper.kronos-size-small  ── the same names, 0.5 / 0.7 of them
                                     + the two things small gives up
```

Every rule in the file keeps its single form and reads `var(--kronos-…)`. Nothing is duplicated per
size, so a change to the layout is still made in one place. The TypeScript adds one class.

That also makes the first task provably safe: replacing literals with custom properties whose values
are the same literals cannot change what large looks like, and the existing tests and a harness
screenshot both say so.

## Files

| File | Change |
| --- | --- |
| `src/apps/size.ts` | **New.** `BarSize`, the list, and a guard — the shape `units.ts` already uses for the step unit |
| `src/settings.ts` | `barSize`: client, listed, three choices, default medium, re-renders on change |
| `src/apps/calendar-bar.ts` | `kronos-size-<size>` on the wrapper; the timeline built only for a GM; `data-target` on each timeline label so the stylesheet can name one rather than count to it |
| `styles/kronos.css` | Tokenised, three value sets, and small's own rules |
| `lang/en.json` | The setting's name and hint, and a label per size |
| `tests/apps/size.test.ts` | **New.** The guard, including the stored-value-no-longer-valid case |
| `tests/apps/calendar-bar.test.ts` | The class per size, medium by default, the labels' targets, and a player's panel having no timeline at all |
| `tests/styles.test.ts` | Every token defined for all three sizes, and no token used that is not defined |
| `tools/harness/*` | `?size=` and the six states in the gallery |
| `README.md` | The setting, and what small gives up |

## The tokens

Roughly forty values, grouped so the three sets stay readable:

| Group | Examples |
| --- | --- |
| Panel | width, compact width, padding, radius |
| Timeline | margin, track height, handle size and glow, marker offset, label height |
| Row | padding, gap, divider padding |
| Text | clock, seconds, weekday, date, tag, weather, condition, label, unit |
| Controls | icon size, button padding and radius, select padding, tab size and offset |

Two ratios, not one — spacing at 0.72 and 0.5, text at 0.85 and 0.7, with a `0.6rem` floor. The values
are written out rather than computed with `calc()` from a single scale: a computed set cannot have a
floor, and hand-written values are what a designer can actually adjust.

## Key decisions

**`min-width: max-content` as a floor on the wrapper.** A nominal width plus a floor means the panel is
440 unless its own contents need more, in which case it grows instead of clipping. This is not
hypothetical — compact overflowed exactly this way during the previous round, when the unit select
turned out wider than the space allowed for it. With six states, three languages' worth of unit labels
and calendars whose month names we do not control, a fixed width with no floor is a bug waiting for a
bug report.

**Small's cuts are made in CSS, not in the render function.** `display: none` on the seconds and on two
labels, exactly as compact already hides things. The markup stays identical at every size, which keeps
one shape to reason about and lets the DOM tests assert that the cuts are *not* structural.

**The labels get `data-target`.** Hiding sunrise and sunset by `:nth-child(2)` and `(4)` would work
today and break silently the day a marker is added or reordered. Naming them costs one attribute.

**The size list gets its own module.** Same reason `StepUnit` has one: the guard is what stops a stale
or hand-edited setting value rendering a panel with no size class at all.

**Dropping the player's timeline simplifies the method rather than adding a branch.** `#timeline`
currently takes `isGM` and uses it twice — to decide whether to build the markers, and whether to put
the action on the track. If it is only ever called for a GM, both branches are dead: the markers always
render and the track always carries its action. So the parameter goes and the method gets shorter,
while the decision moves up to the one place that already knows who is looking.

That also turns the player assertions from a list of absences into one: no timeline. A test that counts
zero markers passes just as well when the render threw and the query found nothing, which is the way
that kind of assertion fails quietly. "The container is not there, and the row that replaced it is" does
not have that hole.

## Measure before cutting

Task 3 starts by rendering small in the harness and reading the controls row's actual width, because
the estimate in the spec says it does not fit and an estimate is not grounds for removing a control.
The number comes from `scrollWidth` against `clientWidth` on the row, at every size, both expanded and
compact, and with the longest names the bundled calendars contain.

If it fits, nothing else is cut. If it does not, the long-step arrows go — the collapse tab already
hides them, so it is a rule that exists rather than a new one — and the condition text after that.

## Tests

| Test | Guards |
| --- | --- |
| `size.test.ts` | The guard accepts the three, rejects everything else, and the default is medium |
| `calendar-bar.test.ts` | One size class, the right one, medium when unset, medium when the stored value is nonsense; labels carry their target; a player has no timeline while still having the row |
| `styles.test.ts` | The three size blocks define the same set of token names; every `var(--kronos-…)` in the file resolves to a token the base block defines |

That last one is the guard that matters most and the one no visual check would catch: a token defined
for large and forgotten for small does not error, it resolves to nothing, and the property silently
falls back to its initial value — a zero padding or an unstyled font size, in one size only.

## Verification

`npm run check`, then the harness for what only a browser can settle:

- large before and after task 1, to show the tokenisation changed no pixel
- all six states, at both bundled calendars, checked for overflow by comparing `scrollWidth` to
  `clientWidth` rather than by eye
- the smallest text on the panel measured, to confirm the floor holds
- a drag at small, since the handle and the track are among the things that scale
- a player at each size, now that their panel is a single row

Each new assertion is watched failing before it is trusted, as in the previous rounds.
