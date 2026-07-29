import { describe, expect, it } from "vitest";

import manifest from "../module.json" with { type: "json" };
import { MODULE_ID, REQUIRED_SYSTEM } from "../src/constants.js";

describe("module.json", () => {
  it("declares the same id the code namespaces settings and flags under", () => {
    // A mismatch here silently breaks every game.settings.get and every flag read, with no
    // error at load time — worth a test even though it looks trivial.
    expect(manifest.id).toBe(MODULE_ID);
  });

  it("declares a relationship to the system the code requires", () => {
    const systems = manifest.relationships.systems.map((s) => s.id);
    expect(systems).toContain(REQUIRED_SYSTEM);
  });

  it("targets Foundry v14 or later", () => {
    expect(Number.parseInt(manifest.compatibility.minimum, 10)).toBeGreaterThanOrEqual(14);
  });
});
