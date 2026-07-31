# 05 — Testing the panel without a Foundry

## What & why

The panel shipped in 0.3.0 was verified by hand, in a browser, with stubbed Foundry globals — and the
harness that did it was thrown away. So the checks that proved the drag writes once, that a player's
DOM carries no controls, and that all twenty glyphs resolve exist nowhere. The next change to the
panel can undo any of them silently.

There is no Foundry available here to test against, and there is no way to get one for free: the
licence is required to *download* the software, not only to run it, which also rules out the
Docker-in-CI route since that image authenticates in order to fetch the distribution. What the
community does instead splits three ways, and only one of the three is open to us:

| Layer | Needs a running Foundry |
| --- | --- |
| Quench — Mocha inside a live world, as a test-runner Application | Yes |
| Vitest with mocked globals | **No** |
| Real instance in Docker driven by Cypress/Playwright | Yes |

So this round takes the middle layer as far as it goes, and makes the two things it cannot reach fail
cleanly instead of half-way.

## Decisions

| Question | Decision |
| --- | --- |
| Harness | Committed as a repo tool, `npm run harness`. Vite dev server, no build step, real source and real stylesheet |
| Automated coverage | Vitest + jsdom, per-file environment so the existing node tests stay fast |
| A mock package | **No.** `foundry-test-utils` covers this ground, but it is ~600 lines of someone else's fidelity for a surface we touch narrowly. Read as reference, not taken as a dependency |
| The modal's chrome | **All-or-nothing.** Gated on the frame actually being present, so a wrong guess yields Foundry's own dialog rather than a half-painted one |
| Quench | Not in this round. It cannot run here, and an untestable test is not worth committing yet |

## What the middle layer does and does not reach

Reaches: everything the module itself builds — the markup, the stylesheet, the timeline geometry, the
GM and player split, compact mode, the icon table, and every calendar, season, condition and hour
without waiting for a world to arrive there.

Does not reach, and cannot be mocked honestly:

- the real `DialogV2` frame markup
- `game.settings.sheet.render(true)`
- hooks firing, `updateWorldTime` between clients, writes to Scene documents, agreement with the PF2e
  World Clock

Mocking those means asserting my own guess against my own guess: it passes and proves nothing. They
stay unverified, and the third task makes the first of them harmless when wrong.

## Acceptance criteria

- `npm run harness` opens the panel in a browser against the real `src/` and the real
  `styles/kronos.css`, with no build step, and query parameters for: player, compact, weather off,
  calendar, date, forced condition, and a gallery of states side by side.
- The harness binds listeners the way the application does, so gestures can be driven in it rather
  than only looked at.
- `npm run test` covers, as assertions rather than as screenshots: a player's DOM carrying no marker,
  no control panel, no gear and no action on the track; the five markers with their minutes and their
  order; the handle's position; compact mode's class and tab; weather absent when switched off; the
  festival tag only on a festival day; and every control carrying both an `aria-label` and a `title`,
  which is what keeps the panel usable if the font fails.
- The existing tests keep running in the node environment — jsdom is per-file, not global.
- The override dialog is either fully the panel's look or fully Foundry's, never a mixture, and the
  stylesheet says why.
- `npm run check` passes, and the harness is type-checked rather than left to rot.

## Edge cases

- **The harness drifting from the application.** It mounts by calling the same `_renderHTML` and
  `_onRender` the application calls; if those change shape, the harness fails to compile rather than
  silently rendering something else.
- **jsdom has no layout.** Anything measured from a bounding box — the drag's arithmetic — cannot be
  asserted there. `minutesAt` is already unit-tested for that reason, and the gesture itself stays a
  harness check.
- **`:has()` unsupported.** Then the gate never matches and the dialog is entirely Foundry's, which
  is the intended degraded state anyway.
- **The probe class being wrong.** Same outcome. The bet is unchanged; only the failure becomes clean.

## Notes

The class name the gate probes for is a guess, and stays one — it could not be confirmed from public
documentation. What changed is the cost of the guess being wrong.
