import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetDarknessPathCache, resolveDarknessPath } from "../../src/scene/darkness.js";

/**
 * The Scene schema path for darkness moved between versions and is not documented for v14, so the
 * module detects it at runtime. These cover each shape it might meet, including the one where it
 * must refuse rather than write to a field that is not there.
 */
const sceneWith = (shape: Record<string, unknown>): never => shape as never;

beforeEach(() => {
  resetDarknessPathCache();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("resolveDarknessPath", () => {
  it("prefers the nested environment field", () => {
    const path = resolveDarknessPath(sceneWith({ environment: { darknessLevel: 0.4 }, darkness: 0.9 }));
    expect(path?.write).toBe("environment.darknessLevel");
  });

  it("reads the value back through the path it chose", () => {
    const scene = sceneWith({ environment: { darknessLevel: 0.4 } });
    expect(resolveDarknessPath(scene)?.read(scene)).toBe(0.4);
  });

  it("falls back to a top-level darknessLevel", () => {
    const path = resolveDarknessPath(sceneWith({ darknessLevel: 0.25 }));
    expect(path?.write).toBe("darknessLevel");
  });

  it("falls back to the legacy darkness field", () => {
    const path = resolveDarknessPath(sceneWith({ darkness: 0.75 }));
    expect(path?.write).toBe("darkness");
  });

  it("refuses when no darkness field exists at all", () => {
    // Writing to an absent field would fail silently, which is the failure mode being avoided.
    expect(resolveDarknessPath(sceneWith({ name: "Tavern" }))).toBeNull();
  });

  it("ignores a field that is present but not a number", () => {
    expect(resolveDarknessPath(sceneWith({ environment: { darknessLevel: null }, darkness: 0.5 }))?.write).toBe(
      "darkness",
    );
  });

  it("treats a darkness of zero as a real value, not a missing one", () => {
    // A fully lit scene reads 0, and `??`-style checks would skip straight past it.
    expect(resolveDarknessPath(sceneWith({ environment: { darknessLevel: 0 } }))?.write).toBe(
      "environment.darknessLevel",
    );
  });

  it("resolves once and stays resolved", () => {
    const first = resolveDarknessPath(sceneWith({ darkness: 0.5 }));
    const second = resolveDarknessPath(sceneWith({ environment: { darknessLevel: 0.5 } }));
    expect(second).toBe(first);
  });
});
