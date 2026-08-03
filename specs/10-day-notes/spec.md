# 10 — Day notes

## What & why

Free text a GM attaches to one in-world day, shown as a marker in the month grid from round 09 and
edited from there. It answers the question the grid could not: not just "what day is the 20th of
Zyullian" but "what did I decide happens on it."

## Decisions

The pre-spec's open questions, settled:

| Question | Decision |
| --- | --- |
| Storage | A world setting: `Record<dayKey, string>`. Simple, and consistent with every other piece of derived-or-manual day state this module already keeps this way (`weatherOverride`, `weatherEffectMap`) |
| Who writes and reads | **GM only**, same as the grid that hosts it. No player visibility, no per-note permission, no player authorship |
| The key | **`dayKey`**, calendar-namespaced exactly like weather. A note written under one calendar does not appear if the world switches to another — a known, accepted property of this key, not new to this round |
| Cardinality | **One note per day.** A day either has a note or does not |
| On the bar | **Grid only.** It does not compete with the festival tag for the bar's limited space |

### Why not journal entries, and why not letting players write

Both were considered and dropped in the same conversation, for a reason worth recording rather than
re-deriving:

- **Journal entries** are Foundry's native place for prose and would have given real per-document
  privacy — but nothing here needs privacy, since the feature is GM-only end to end. Paying for
  per-document permissions to protect nothing is the wrong trade.
- **Player-authored notes** were considered, with a per-note GM-only / public / author-only mode. Two
  facts about Foundry killed it: a `scope: "world"` setting can only be written by a GM — a player
  calling `game.settings.set` on one is a permission error, not a UI restriction — and a world setting
  is not private from anyone regardless of scope, since its full value is sent to every connected
  client. Real per-user privacy needs per-document ownership, i.e. journal entries, which is a much
  larger feature than "a GM jots something down." Dropped in favour of the simple version.

## Acceptance criteria

- A control on the grid's selected cell (GM only) opens a modal to write, edit or delete that day's
  note.
- A day carrying a note is visibly marked in the grid, distinctly from the "today" mark and the
  "selected" mark, at all three sizes.
- Saving persists the note under that day's `dayKey`. Reopening the grid, or reloading, still shows
  the marker and the same text.
- Saving whitespace-only text clears the note rather than storing it — a day cannot carry a note that
  is invisible in the grid but present in storage.
- Deleting a note removes the marker along with the stored entry.
- The note is never rendered on the bar itself, only inside the grid.
- A player's panel has no note marker and no control to reach one — it inherits the grid's GM-only
  gating, same as round 09.
- Switching the active calendar does not error. Notes keyed under the previous calendar's namespace
  simply stop appearing, the same way a weather override does today.
- `npm run check` passes.

## Edge cases

- **Two GMs saving notes for different days at close to the same time.** The setting is one object;
  the second write can lose the first's change. A known property of this storage shape, already true
  for `weatherEffectMap` — not solved this round, and not new.
- **A note on a day a shorter month later removes** (the calendar file changes, or a different
  calendar is chosen with fewer days in that month). The entry is not garbage-collected; it simply
  never renders, since nothing asks for a `dayKey` that no longer resolves to a visible cell. Harmless,
  not cleaned up.
- **Note text containing characters that would break the edit modal's markup** (`<`, `&`, quotes). The
  text must round-trip through the textarea exactly, which means escaping it on the way into the
  dialog's HTML, not just trusting it.
- **A very long note.** No length cap this round. The grid marker does not preview content, so length
  cannot affect the grid's layout — only the modal's textarea, which scrolls.

## Open questions

1. **Does a selected cell have room for two controls** — the existing go-to-day control from round 09
   and this round's edit-note control — at the small size, where a cell is 61×42px? Measure it in the
   harness rather than assuming, the way round 09 measured the grid itself before trusting it.
2. **Which glyph reads as "a note" at three sizes**, small enough that it doesn't need to be looked up
   from Material Symbols. Pick one and verify it against the upstream codepoint table the way every
   other bundled icon already is.

## Touches

`src/settings.ts` (new setting), `src/time/clock.ts` (a pure day-key facade), `src/time/notes.ts`
(new), `src/apps/month-grid.ts`, `src/apps/calendar-bar.ts`, `src/apps/day-note.ts` (new modal),
`src/apps/icons.json`, `styles/kronos.css`, `lang/en.json`.

## Size and dependencies

Medium. Wants 09, which it already has — the grid is built and this hangs a marker and a control off
its selected cell.
