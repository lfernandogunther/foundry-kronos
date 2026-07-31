# 05 — Plan

## Files

| File | Change |
| --- | --- |
| `tools/harness/index.html` | **New.** The page. Links the real stylesheet by absolute path so its relative font URL resolves the same way Foundry resolves it |
| `tools/harness/globals.ts` | **New.** The Foundry stubs, and a mutable store the page can drive from query parameters |
| `tools/harness/main.ts` | **New.** Imports the stubs first, then the bar, then mounts — including `_onRender`, so gestures work |
| `vite.harness.config.ts` | **New.** Dev server rooted at the repo so `/src` and `/styles` are both reachable |
| `package.json` | `harness` script; `jsdom` devDependency |
| `tsconfig.json` | `tools/harness` and the harness config added to `include`, so they are type-checked |
| `tests/helpers/panel.ts` | **New.** Renders the panel under a described world and restores every global afterwards |
| `tests/apps/calendar-bar.test.ts` | **New.** The assertions listed in the spec, under `@vitest-environment jsdom` |
| `styles/kronos.css` | The modal's chrome gated on the frame being present |

## Key decisions

**The harness is a dev server, not a build.** The throwaway version bundled with `vite build` into a
folder and was served statically, which meant a rebuild between every edit. Rooting a dev server at
the repo lets the page import `/src/apps/calendar-bar.ts` directly and reload on save, and it removes
the temporary config and output folder that had to be deleted by hand before each commit.

**The stubs live in `tools/`, not in `tests/`.** `tests/setup.ts` is deliberately inert — its own
comment says so — and exists only to make the import graph loadable. The harness needs the opposite:
a store that answers settings reads with chosen values. Keeping them apart stops the test setup
growing a second job.

**Import order is load-bearing.** `calendar-bar.ts` subclasses `ApplicationV2` at module scope, so
`foundry` has to exist before it is imported. ES imports are hoisted, so the stubs cannot be set in
the same module that imports the bar — hence a separate `globals.ts` imported first, which is the same
shape `tests/setup.ts` already uses.

**The helper patches and restores rather than building a world once.** Each test states the world it
wants; anything it does not state falls to the module's own defaults. `setCalendar` is module state and
is restored too, or one test's calendar leaks into the next.

**jsdom per file, not globally.** `@vitest-environment jsdom` on the one file that needs a document.
Making it global would slow every arithmetic test for no gain, and would hide the fact that the rest
of the suite genuinely does not need a DOM.

## The modal, made all-or-nothing

Today the root gets our card treatment unconditionally while the inner rules depend on class names
that could not be confirmed. If they are wrong, the result is our dark card wrapped around Foundry's
default innards — the worst of both.

Every cosmetic rule becomes conditional on the frame being there:

```css
.kronos-modal:has(.window-content) { … }
```

If the probe misses, nothing applies and the dialog is entirely Foundry's, which is a perfectly good
dialog. The custom properties stay unconditional because on their own they paint nothing.

`.kronos-override`, on our own injected form, stays unconditional — that markup is ours and cannot be
wrong.

## Verification

`npm run check` for the suite and the build. Then the harness: the three views, and the drag driven in
it to confirm one write on release. The mutation discipline holds — each new assertion is watched
failing before it is trusted, starting with the player-DOM one, which is the assertion most likely to
pass for the wrong reason if the render throws and the query finds nothing.

The modal gate cannot be verified here at all. What can be verified is the contract: with the probe
class absent from a fixture, none of the cosmetic rules match.
