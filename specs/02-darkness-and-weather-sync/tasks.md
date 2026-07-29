# 02 — Tasks

One commit per item.

- [ ] **1. Fix the weather dialog** — `DialogV2.prompt()` → `wait()`, so the injected `Confirm`
      that discards the form disappears
- [ ] **2. Make weather sync work** — default on, resolve the scene via `canvas.scene`, and log a
      reason for every early return instead of failing silently
- [ ] **3. Darkness curve** — `src/scene/darkness-curve.ts`, smoothstep ramps around the seasonal
      sun times, with tests
- [ ] **4. Darkness writes** — `src/scene/darkness.ts`: detected schema path, active-GM only,
      epsilon threshold, lock respected, animated
- [ ] **5. Per-scene checkbox** — darkness control in scene configuration, beside the weather opt-out
- [ ] **6. Conflict detection** — warn once when PF2e `syncDarkness` or SmallTime's darkness
      control is also active
- [ ] **7. Remove hover effects** — drop the button hover rules
- [ ] **8. Settings and strings** — night/day levels, twilight length, `lang/en.json`

## Open

- The scene darkness schema path is unconfirmed against a live world. Task 4 detects it at runtime
  and logs which one it used; if the console shows the feature disabling itself, that log says why.
