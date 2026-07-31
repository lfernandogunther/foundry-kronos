import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync("styles/kronos.css", "utf8");

/** The class the dialog styling probes for before applying anything. */
const GATE = ":has(.window-content)";

interface Rule {
  selector: string;
  declarations: string[];
}

/**
 * A flat CSS parser, which is all this file needs — it has no nesting and no media queries. At-rules
 * are dropped: `@font-face` has no selector to reason about.
 */
function rules(source: string): Rule[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((match) => ({
      selector: match[1]!.trim().replace(/\s+/g, " "),
      declarations: match[2]!
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean),
    }))
    .filter((rule) => !rule.selector.startsWith("@"));
}

const parsed = rules(css);

/** Custom properties on their own paint nothing, so they need no gate. */
const onlyCustomProperties = (rule: Rule): boolean =>
  rule.declarations.length > 0 && rule.declarations.every((declaration) => declaration.startsWith("--"));

describe("the stylesheet", () => {
  it("parses into rules, so the checks below are not vacuous", () => {
    expect(parsed.length).toBeGreaterThan(30);
    expect(parsed.every((rule) => rule.selector.length > 0)).toBe(true);
  });

  it("applies nothing outside the panel except the dialog's own classes", () => {
    // The design this came from styles `*` and `body`. This module lives inside someone else's
    // application and may not restyle an element it does not own.
    const strays = parsed
      .map((rule) => rule.selector)
      .filter((selector) => !selector.includes("#foundry-kronos"))
      .filter((selector) => !selector.includes(".kronos-modal") && !selector.includes(".kronos-override"));

    expect(strays).toEqual([]);
  });
});

describe("the override dialog's styling", () => {
  const modalRules = parsed.filter((rule) => rule.selector.includes(".kronos-modal"));

  it("has rules to check", () => {
    expect(modalRules.length).toBeGreaterThan(5);
  });

  it("gates every cosmetic rule on the dialog frame actually being there", () => {
    // The element names inside Foundry's frame are not documented publicly, so they are a guess. The
    // gate is what makes a wrong guess produce Foundry's own dialog instead of our card wrapped
    // around its untouched innards. A rule added later without the gate reintroduces exactly that.
    const ungated = modalRules
      .filter((rule) => !rule.selector.includes(GATE))
      .filter((rule) => !onlyCustomProperties(rule))
      .map((rule) => rule.selector);

    expect(ungated).toEqual([]);
  });

  it("keeps the custom properties ungated, since alone they paint nothing", () => {
    const tokens = modalRules.find((rule) => onlyCustomProperties(rule));
    expect(tokens?.selector).toBe(".kronos-modal");
  });

  it("does not gate the form this module injects itself", () => {
    // `.kronos-override` is on our own markup, so it cannot be a wrong guess and must always apply.
    const ours = parsed.filter((rule) => rule.selector.includes(".kronos-override"));
    expect(ours.length).toBeGreaterThan(0);
    for (const rule of ours) expect(rule.selector, rule.selector).not.toContain(GATE);
  });
});
