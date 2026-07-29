# 01 — Tasks

One commit per item.

- [x] **0. Scaffold** — `git init`, Vite + TS + vitest, `module.json`, this spec
- [ ] **1. PF2e clock adapter** — `src/time/pf2e-clock.ts` + `src/time/calendar.ts`, feature
      detection with fallback, label data file, tests
- [ ] **2. Season + sun math** — `src/time/season.ts`, `src/time/sun.ts`, tests against known
      solstice/equinox values
- [ ] **3. Step units** — `src/time/units.ts`, clamped month/year arithmetic, tests across
      28/30/31-day months and a leap year
- [ ] **4. Toolbar readout** — `src/apps/calendar-bar.ts`, template, CSS; no controls yet
- [ ] **5. Arrow controls** — four arrows + unit select, GM-gated
- [ ] **6. Jump buttons** — sunrise / noon / sunset / midnight, always forward
- [ ] **7. Real-time clock** — `src/time/ticker.ts` + `⏸` button, activeGM-only, shared pause state
- [ ] **8. Weather engine** — `src/weather/generator.ts`, `src/weather/state.ts`, day-rollover
      regeneration
- [ ] **9. Weather override** — `src/apps/weather-override.ts` GM dialog
- [ ] **10. Scene weather sync** — `src/weather/scene-sync.ts`, mapping setting, per-scene opt-out,
      no-stomp guard
- [ ] **11. Polish** — bar position persistence, settings UI, `lang/en.json`

## Blocked / waiting

- Task 1 wants the `CONFIG.PF2E.worldClock` console dump from the live world. Written defensively
  until it arrives.
