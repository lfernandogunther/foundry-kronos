# 01 — Tasks

One commit per item.

- [x] **0. Scaffold** — `git init`, Vite + TS + vitest, `module.json`, this spec
- [x] **1. PF2e clock adapter** — `src/time/pf2e-clock.ts` + `src/time/calendar.ts`, feature
      detection with fallback, label data file, tests
- [x] **2. Season + sun math** — `src/time/season.ts`, `src/time/sun.ts`, tests against known
      solstice/equinox values
- [x] **3. Step units** — `src/time/units.ts`, clamped month/year arithmetic, tests across
      28/30/31-day months and a leap year
- [x] **4. Toolbar readout** — `src/apps/calendar-bar.ts`, template, CSS; no controls yet
- [x] **5. Arrow controls** — four arrows + unit select, GM-gated
- [x] **6. Jump buttons** — sunrise / noon / sunset / midnight, always forward
- [x] **7. Real-time clock** — `src/time/ticker.ts` + `⏸` button, activeGM-only, shared pause state
- [x] **8. Weather engine** — `src/weather/generator.ts`, `src/weather/state.ts`, day-rollover
      regeneration
- [x] **9. Weather override** — `src/apps/weather-override.ts` GM dialog
- [x] **10. Scene weather sync** — `src/weather/scene-sync.ts`, mapping setting, per-scene opt-out,
      no-stomp guard
- [x] **11. Polish** — bar position persistence, settings UI, `lang/en.json`

## Waiting

- The `CONFIG.PF2E.worldClock` shape is still unconfirmed against a live world. The adapter is
  feature-detected with a fallback and logs a warning at startup if its dates disagree with the
  system World Clock, so a mismatch surfaces rather than passing silently.
