/**
 * How much room the panel may take on screen.
 *
 * A size is a set of values in the stylesheet, not a different layout: the markup is identical at all
 * three, and what changes is spacing, type size and how much the smallest one prints. `large` is what
 * the module shipped before sizes existed, so a client that chooses it sees no change.
 */

export type BarSize = "small" | "medium" | "large";

export const BAR_SIZES: readonly BarSize[] = ["small", "medium", "large"] as const;

/**
 * The size a client gets before choosing one.
 *
 * Medium rather than large: the size people complained about is the one they are shown on installing,
 * and a default nobody picked is the one worth changing.
 */
export const DEFAULT_BAR_SIZE: BarSize = "medium";

export function isBarSize(value: unknown): value is BarSize {
  return typeof value === "string" && (BAR_SIZES as readonly string[]).includes(value);
}

/** The class the stylesheet keys each size off. */
export const sizeClass = (size: BarSize): string => `kronos-size-${size}`;
