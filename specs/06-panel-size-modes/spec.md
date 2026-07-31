# 06 — Size modes for the panel

## What & why

The panel is too big. It is 880 pixels of card sitting over someone's canvas, and the design review
put the target at about half that.

Rather than shrink it once and argue about the number, the size becomes a choice: **small**, **medium**
or **large**, per client. Large is exactly what ships today, so nobody's panel changes under them.
Medium becomes what a new install gets, because the size being complained about is the one people see
first.

This is a second axis, not a replacement for the collapse tab. They answer different questions:

| | Question it answers |
| --- | --- |
| **Size** | How much room may the panel take on my screen? |
| **Compact** (the tab) | How much do I want to see right now? |

So there are six states, and all six have to work.

## Decisions

| Question | Decision |
| --- | --- |
| Widths | **880 / 660 / 440.** Small is half, which is the target |
| Default | **Medium** |
| Scope | Client, like the position and the collapse state — screen size is not a world decision |
| Where it is chosen | The module settings, reachable from the panel's own gear |
| Compact widths | 520 / 420 / 340, provisional — validated by measurement, not by arithmetic |
| Uniform scaling | **No.** Text has a floor; spacing does not. Two different ratios |
| Small drops | The seconds line, and the sunrise/sunset labels under the timeline. Tags stay |
| Overflow | A floor of `min-width: max-content`, so no size can ever be narrower than its own contents |
| The timeline for players | **Removed entirely.** Not read-only — absent |

## The player's panel loses the timeline

Round 04 gave a player the timeline without its controls: the bar and the handle, showing where in the
day the sun sits, with nothing to drag. **That is reversed here.** A player gets no timeline at all.

Little information goes with it. The clock states the time in figures, and the weather icon already
switches between its day and night forms from the same solar model the timeline was drawn from. What
was left was decoration occupying the top half of a card that is being asked to get smaller.

The consequence is that a player's panel becomes a single row — time, date, weather — which is close
to what the module looked like before round 04. At small, that is a very short, very wide card, and
that shape is what the width floor has to cope with.

## Not a uniform scale

Halving every value does not work. The smallest text on the panel is already `0.65rem` — about ten
pixels — and half of that is unreadable. So spacing and text scale on different curves:

| | large | medium | small |
| --- | --- | --- | --- |
| Spacing, radii, control sizes | 1.0 | 0.72 | 0.5 |
| Text | 1.0 | 0.85 | 0.7 |
| Floor for any text | — | — | `0.6rem` |

The consequence is that small is not a photographic reduction of large: it is proportionally more text
in less space. That is the intended trade, and it is why small also gives things up.

## The horizontal constraint, which is the real one

The two things small gives up — the seconds line and two timeline labels — are both stacked
*vertically*. Removing them buys height, not width. But width is what runs out.

A first estimate of the controls row at small scale:

| Block | Estimate |
| --- | --- |
| Time | ~70px |
| Date | ~128px |
| Weather | ~75px |
| Controls (7 items) | ~210px |
| Gaps | ~24px |
| **Total** | **~507px** into ~418px of usable width |

If that estimate holds, small needs to drop something horizontal as well, and the likeliest candidate
is the pair of long-step arrows — which the collapse tab already hides, so there is precedent and no
new idea to explain. The condition text beside the temperature is the next one.

**This is measured, not estimated, before anything is cut.** The harness renders the real panel with
the real font, so the number is available for the asking; an estimate is not a reason to remove a
control. See the open question.

## Acceptance criteria

- A client setting chooses small, medium or large. Changing it re-renders the panel immediately.
- A new install gets medium. A client that has already chosen keeps its choice.
- Large is pixel-identical to what ships in 0.3.0 — the tokenisation is provably a no-op at large.
- All six states render without the content overflowing the card, at every calendar, and with the
  longest month and weekday names the bundled calendars contain.
- No text renders below `0.6rem`.
- Small shows five timeline markers but three labels, and no seconds line.
- A player's panel contains no timeline: no track, no handle, no labels, no markers. Absent from the
  markup, not hidden by a rule — a hidden element is one CSS mistake away from coming back.
- Every scaling value in the stylesheet is a custom property, and every one of them is defined for all
  three sizes — a token defined for large and forgotten for small would silently collapse to nothing.
- The panel remains draggable, the timeline remains usable, and the handle still lands where it is
  dropped, at every size.
- `npm run check` passes, and the harness can show any size, including a gallery of all six states.

## Edge cases

- **Long names.** `min-width: max-content` means a panel can exceed its nominal width rather than
  clipping. A calendar with very long month names makes small wider than 440 instead of broken.
- **A translated unit select.** The select sizes to its widest option, which is why compact overflowed
  once before. The same floor covers it.
- **Small and compact together.** The narrowest state, with the least content. It has to stay usable:
  the time, the date, one arrow either side, the unit and the gear.
- **A player at small.** No timeline and no control panel, so the panel is one row of three blocks.
  It must not read as an empty stretched card, and its width floor is what stops it collapsing.
- **The collapse tab at small.** The tab scales too, or a 24px tab hangs off a panel built at half
  scale and looks bolted on.
- **A size stored that no longer exists.** Read through a guard and fall back to medium, the way the
  step unit already does.

## Open questions

1. ~~**Does the small controls row fit in 440px?**~~ **Measured: no.** The row needs 505px where 416
   exist — 89 over, which the estimate above had at 507. Removing the long-step arrows takes it to 48
   over and the condition text to 38 over. Deepening the cut on the clock and the date, the two widest
   things in the row, closes it to 14. Removing the seconds line changes it by **nothing**, measured,
   which is the point the estimate was making: it is stacked vertically and buys height, not width.

   So small carries the two content cuts, and the residual is absorbed by the width floor rather than
   by taking a control away or pushing text under the readable floor.

   The measurement also turned up something that was already shipped: **the collapsed panel has been
   overflowing its own width since collapsing was added** — by 28px at large. The floor fixes it, which
   makes the collapsed panel wider than its nominal width at every size.

## Measured, once it was built

Every state, with the bundled Golarion calendar and the English unit labels. Nothing overflows
anywhere; the nominal width is a floor the panel may exceed, never a box it is clipped into.

| | GM | GM, collapsed | Player | Player, collapsed |
| --- | --- | --- | --- | --- |
| large | 880 | 558 | 493 | 315 |
| medium | 664 | 469 | 404 | 268 |
| small | **462** | 384 | 292 | 216 |

A GM at small lands at 462 rather than 440 — 5% over the target. Closing that last 22px would mean
taking away the year, a control, or the readable floor on text, and none of those looked worth it
against 22 pixels. A player at small is 292, which is a third of what the panel was.

The smallest text rendered anywhere at small measures 9.6px, which is exactly the `0.6rem` floor.

## Notes

The compact widths in the table are starting points. The binding constraint is content, not a number
chosen for symmetry, so they are validated in the harness like everything else here.

Removing the player's timeline reverses a decision taken in round 04, which is recorded there and left
standing there — a spec says what was decided at the time, and this one says what replaced it.
