# 14 — Step modes as pairs (pre-spec)

Not a spec yet.

## The two models

**Ours.** A unit — second, round, minute, hour, day, month, year — and a multiplier setting. The inner
arrows move one unit, the outer arrows move the multiple, which defaults to ten.

**The reference.** Four paired modes in one select: `Min / Horas`, `Rounds / Min`, `Dias / Meses`,
`Meses / Anos`. One choice sets what both pairs of arrows do.

## The trade

Theirs is fewer decisions and reads better in a narrow panel: the select says exactly what all four
arrows will do. Ours is more flexible, already configurable, and covers combinations theirs cannot —
seconds, and any multiplier a GM likes.

There is a size argument too. The unit select is one of the widest things in the controls row, and at
small it is one of the reasons the row does not fit. A shorter label helps; a longer one like
`Meses / Anos` does not.

## To decide before the spec

1. **Replace, or add?** A paired mode could be what the select offers while the multiplier setting stays
   as an escape hatch for anyone who wants eleven.
2. **Which pairs.** The reference's four leave out seconds entirely, and our seven units do not divide
   into four pairs cleanly.
3. **Does it survive the smallest size?** If the answer to 14 makes the select wider, it works against
   round 06.

## Size and dependencies

Small. Nothing blocks it. Mostly a question of which is nicer to use, which makes it a good one to settle
with the designer rather than in code.
