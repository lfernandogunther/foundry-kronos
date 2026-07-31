# 05 — Tasks

One commit per item.

- [x] **1. The harness as a repo tool** — `tools/harness/` (page, stubs, mount) and
      `vite.harness.config.ts`, run by `npm run harness`. Query parameters for player, compact,
      weather off, calendar, date, forced condition and a gallery of states. Mounts through the same
      `_renderHTML` and `_onRender` the application uses, so gestures can be driven in it. Added to
      `tsconfig.json` so it is type-checked rather than left to rot

- [ ] **2. DOM tests** — `jsdom` as a devDependency, `tests/helpers/panel.ts` to render the panel
      under a described world and restore the globals after, and `tests/apps/calendar-bar.test.ts`
      under `@vitest-environment jsdom`: the player's DOM, the five markers and their order, the
      handle, compact, weather off, the festival tag, and the label on every control. Per-file
      environment, so the existing tests stay in node

- [ ] **3. The modal, all-or-nothing** — every cosmetic rule in `kronos.css` gated on the dialog frame
      being present, so an unconfirmed class name yields Foundry's own dialog rather than our card
      wrapped around its innards. A test asserting the contract against a fixture without the probe
      class

## Verify

`npm run check`, then the harness: the three views, and the drag driven in it to confirm one write on
release. Each new assertion watched failing before it is trusted.
