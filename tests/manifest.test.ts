import { describe, expect, it } from "vitest";

import manifest from "../module.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };
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

describe("manifest URL install", () => {
  it("points the update check at the latest release rather than a fixed one", () => {
    // Foundry re-fetches this exact URL to notice new versions. Pinned to a version it would
    // report the installed release as current forever, with no error anywhere.
    expect(manifest.manifest).toBe(`${manifest.url}/releases/latest/download/module.json`);
  });

  it("downloads the archive belonging to its own version", () => {
    // The counterpart: `download` must be pinned, because the manifest attached to an old release
    // has to keep fetching that release's zip. Bumping `version` without bumping this URL ships a
    // release that quietly installs the previous one.
    expect(manifest.download).toBe(`${manifest.url}/releases/download/v${manifest.version}/${manifest.id}.zip`);
  });

  it("keeps the package version in step with the manifest version", () => {
    // `npm version` moves package.json alone; the manifest is what Foundry reads.
    expect(pkg.version).toBe(manifest.version);
  });
});
