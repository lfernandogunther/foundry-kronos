# 16 — Round and encounter awareness (pre-spec)

Not a spec yet.

## What the reference does, and why we did not

The reference prints `00s (Round 1)` under the clock, deriving a round number from the seconds on the
wall clock. Round 04 dropped it: Foundry's encounter tracker owns the real round number, and a second
one derived from a clock would contradict it on screen.

## The version that is not wrong

When an encounter is actually running, show **its** round, from `game.combats.active`. That is
information the reference could not have had, and it is what a GM at the table actually wants to see.

The two ideas already meet: the clock stops for encounters by default, and the halt reason the pause
button reports is already `combat`. So the panel knows an encounter is running — it just does not say
which round.

## To decide before the spec

1. **What the line says with no encounter.** The seconds, as now? Nothing? The choice decides whether
   this is a new element or a change to an existing one.
2. **Does it replace the seconds line or sit beside it?** Small hides the seconds entirely, so a round
   shown there would disappear exactly when an encounter is running.
3. **Players.** Players can see the encounter tracker already, so showing the round to them costs
   nothing and duplicates something.
4. **Whether the round is worth the coupling.** It ties the panel to combat state, which is a hook and a
   refresh path we already have for the clock — so it is cheap — but it is one more reason for the panel
   to re-render.

## Size and dependencies

Small. Nothing blocks it.
