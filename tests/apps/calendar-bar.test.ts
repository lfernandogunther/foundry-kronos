// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { ICON } from "../../src/apps/icons.js";
import { STEP_UNITS } from "../../src/time/units.js";
import { all, one, renderPanel } from "../helpers/panel.js";

/**
 * The panel's markup, asserted rather than screenshotted.
 *
 * These were all verified by hand in a browser once and then existed nowhere. jsdom has no layout, so
 * nothing measured from a bounding box belongs here — the drag's arithmetic is unit-tested in
 * `timeline.test.ts` and the gesture itself stays a harness check. What is left is structure, which is
 * most of what a redesign can break.
 */

/** Late evening on 1 January of the stub world's first year. */
const EVENING = 79_200;

describe("what a player is shown", () => {
  it("carries no control a player may not use", async () => {
    const panel = await renderPanel({ isGM: false });

    // Absent, not hidden: a disabled control someone can see is an invitation to ask the GM to
    // press it, and a CSS mistake would turn a hidden one back on.
    expect(all(panel, ".kronos-marker")).toHaveLength(0);
    expect(all(panel, ".kronos-time-controls")).toHaveLength(0);
    expect(all(panel, ".kronos-settings")).toHaveLength(0);
    expect(all(panel, ".kronos-unit")).toHaveLength(0);
    expect(one(panel, ".kronos-track")?.hasAttribute("data-action")).toBe(false);
    expect(all(panel, ".kronos-weather.kronos-clickable")).toHaveLength(0);
  });

  it("still reports the time, the date and the weather", async () => {
    const panel = await renderPanel({ isGM: false, worldTime: EVENING });

    expect(one(panel, ".kronos-time")?.textContent).toBe("22:00");
    expect(one(panel, ".kronos-datum")?.textContent).toMatch(/^01 \w+ \(\d+\)$/);
    expect(one(panel, ".kronos-weather")).not.toBeNull();
    expect(one(panel, ".kronos-handle")).not.toBeNull();
  });

  it("can still collapse its own panel", async () => {
    // The tab is a per-client preference, not a GM control.
    expect(one(await renderPanel({ isGM: false }), ".kronos-tab")).not.toBeNull();
  });
});

describe("what a GM is shown", () => {
  it("places five markers, in order, none of them able to change the date", async () => {
    const markers = all(await renderPanel({ worldTime: EVENING }), ".kronos-marker");
    expect(markers).toHaveLength(5);

    const minutes = markers.map((marker) => Number(marker.dataset["minutes"]));
    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
    expect(minutes[0]).toBe(0);
    for (const value of minutes) expect(value).toBeLessThanOrEqual(1439);

    const percents = markers.map((marker) => Number.parseFloat(marker.style.left));
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
  });

  it("offers every step unit, with the current one selected", async () => {
    const panel = await renderPanel({ settings: { stepUnit: "hour" } });
    const select = one(panel, ".kronos-unit") as HTMLSelectElement | null;

    expect(select?.options).toHaveLength(STEP_UNITS.length);
    expect(select?.value).toBe("hour");
  });

  it("steps by the configured multiple on the outer arrows and by one on the inner", async () => {
    const panel = await renderPanel({ settings: { stepMultiplier: 7 } });
    const counts = all(panel, '[data-action="step"]').map((button) => button.dataset["count"]);
    expect(counts).toEqual(["-7", "-1", "1", "7"]);
  });

  it("marks the clock as running only when nothing is holding time still", async () => {
    const running = one(await renderPanel({ clockRunning: true }), '[data-action="toggle-clock"]');
    expect(running?.classList.contains("kronos-active")).toBe(true);
    expect(running?.classList.contains("kronos-stalled")).toBe(false);

    // Switched on, but the game is paused: stalled rather than active.
    const stalled = one(await renderPanel({ clockRunning: true, paused: true }), '[data-action="toggle-clock"]');
    expect(stalled?.classList.contains("kronos-active")).toBe(false);
    expect(stalled?.classList.contains("kronos-stalled")).toBe(true);

    const stopped = one(await renderPanel({ clockRunning: false }), '[data-action="toggle-clock"]');
    expect(stopped?.classList.contains("kronos-active")).toBe(false);
    expect(stopped?.classList.contains("kronos-stalled")).toBe(false);
  });

  it("lets a GM set the weather and a player not", async () => {
    expect(one(await renderPanel({}), '.kronos-weather[data-action="override-weather"]')).not.toBeNull();
    expect(one(await renderPanel({ isGM: false }), '[data-action="override-weather"]')).toBeNull();
  });
});

describe("the handle", () => {
  it("sits where the time of day puts it", async () => {
    const midnight = one(await renderPanel({ worldTime: 0 }), ".kronos-handle");
    expect(midnight?.style.left).toBe("0%");

    const noon = one(await renderPanel({ worldTime: 43_200 }), ".kronos-handle");
    expect(noon?.style.left).toBe("50%");
  });
});

describe("collapsed", () => {
  it("marks the wrapper and turns the tab around", async () => {
    const compact = await renderPanel({ compact: true });
    expect(compact.classList.contains("kronos-compact")).toBe(true);
    expect(one(compact, ".kronos-tab .kronos-icon")?.textContent).toBe(ICON.expand);

    const expanded = await renderPanel({ compact: false });
    expect(expanded.classList.contains("kronos-compact")).toBe(false);
    expect(one(expanded, ".kronos-tab .kronos-icon")?.textContent).toBe(ICON.collapse);
  });

  it("keeps the controls that survive the narrower panel in the markup", async () => {
    // Compact hides things in CSS, so the markup is unchanged — asserted so that moving the
    // hiding into the render function would be noticed.
    const compact = await renderPanel({ compact: true });
    expect(all(compact, ".kronos-long-step")).toHaveLength(2);
    expect(one(compact, ".kronos-unit")).not.toBeNull();
    expect(one(compact, ".kronos-timeline")).not.toBeNull();
  });
});

describe("weather switched off", () => {
  it("leaves the block out entirely rather than empty", async () => {
    const panel = await renderPanel({ weatherEnabled: false });
    expect(all(panel, ".kronos-weather")).toHaveLength(0);
    expect(all(panel, ".kronos-temp")).toHaveLength(0);

    // And the rest of the row is still there.
    expect(one(panel, ".kronos-clock")).not.toBeNull();
    expect(one(panel, ".kronos-time-controls")).not.toBeNull();
  });
});

describe("the festival tag", () => {
  it("appears only on a day that carries one", async () => {
    // Tarlan is anchored so that 1 January 2025 is Enudar 1, which is Enudrani's Renewal.
    const anchor = Date.parse("2025-01-01T12:00:00Z") / 1000;

    const festival = await renderPanel({ calendar: "tarlan", worldTime: anchor });
    expect(one(festival, ".kronos-tag-festival")?.textContent).toContain("Renewal");

    const ordinary = await renderPanel({ calendar: "tarlan", worldTime: anchor + 86_400 });
    expect(all(ordinary, ".kronos-tag-festival")).toHaveLength(0);

    // The season tag is on every day, so its absence would not be what the test above caught.
    expect(one(ordinary, ".kronos-tag-season")).not.toBeNull();
  });
});

describe("every control", () => {
  it("says what it does in text, so the panel survives the icon font failing", async () => {
    const panel = await renderPanel({ worldTime: EVENING });
    const buttons = all(panel, "button");

    expect(buttons.length).toBeGreaterThan(8);
    for (const button of buttons) {
      const label = button.getAttribute("aria-label");
      expect(label, button.outerHTML).toBeTruthy();
      expect(button.title, button.outerHTML).toBe(label);

      // A key that reached the DOM unlocalised means the string is missing from lang/en.json.
      expect(label, button.outerHTML).not.toMatch(/^KRONOS\./);
    }
  });

  it("draws its icon as a single character from the bundled table", async () => {
    const panel = await renderPanel({ worldTime: EVENING });
    const known = new Set(Object.values(ICON));

    const icons = all(panel, ".kronos-button .kronos-icon");
    expect(icons.length).toBeGreaterThan(8);
    for (const icon of icons) {
      expect([...(icon.textContent ?? "")]).toHaveLength(1);
      expect(known).toContain(icon.textContent);
    }
  });
});
