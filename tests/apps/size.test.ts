import { describe, expect, it } from "vitest";

import { BAR_SIZES, DEFAULT_BAR_SIZE, isBarSize, sizeClass } from "../../src/apps/size.js";

describe("the panel sizes", () => {
  it("offers three, smallest first", () => {
    expect(BAR_SIZES).toEqual(["small", "medium", "large"]);
  });

  it("defaults to medium", () => {
    // Large is what shipped before sizes existed; medium is the change, and it is the default
    // precisely because the size people complained about is the one an install shows them.
    expect(DEFAULT_BAR_SIZE).toBe("medium");
    expect(BAR_SIZES).toContain(DEFAULT_BAR_SIZE);
  });

  it("accepts the three it knows", () => {
    for (const size of BAR_SIZES) expect(isBarSize(size), size).toBe(true);
  });

  it("rejects anything else", () => {
    // A stored setting can be stale or hand-edited, and an unrecognised value would otherwise put a
    // class on the panel that the stylesheet has no values for.
    for (const value of ["", "SMALL", "tiny", "huge", "medium ", null, undefined, 1, {}, ["small"]]) {
      expect(isBarSize(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("names a class per size", () => {
    expect(BAR_SIZES.map(sizeClass)).toEqual(["kronos-size-small", "kronos-size-medium", "kronos-size-large"]);
  });
});
