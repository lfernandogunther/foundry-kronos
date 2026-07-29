import { getClockRatio, getClockTickSeconds, isClockRunning, shouldPauseOnCombat } from "../settings.js";

/**
 * The real-time clock.
 *
 * Advancing world time is a write broadcast to every connected client, which re-triggers darkness
 * sync and every module's `updateWorldTime` handler, so this ticks in coarse steps rather than
 * once a second.
 *
 * Only the active GM runs the interval. With two GMs connected an unguarded ticker would advance
 * time twice per tick; with none, it must not advance at all.
 */

let intervalId: ReturnType<typeof setInterval> | null = null;
let advancing = false;

function isTickingClient(): boolean {
  return game.user.isGM && game.users.activeGM?.id === game.user.id;
}

/**
 * Why the clock is not currently running, or null if it is. Returned rather than logged so the
 * button can explain itself in a tooltip.
 */
export function haltReason(): string | null {
  if (!isClockRunning()) return "paused";
  if (!isTickingClient()) return "no-active-gm";
  if (game.paused) return "game-paused";
  if (shouldPauseOnCombat() && game.combats?.active?.started) return "combat";
  return null;
}

async function tick(): Promise<void> {
  // A slow world update must not stack ticks on top of each other.
  if (advancing || haltReason() !== null) return;

  advancing = true;
  try {
    await game.time.advance(getClockRatio() * getClockTickSeconds());
  } catch (error) {
    console.error("pf2e-calendar-bar | advancing world time failed:", error);
  } finally {
    advancing = false;
  }
}

/**
 * Starts or stops the interval to match current conditions. Safe to call repeatedly — it is the
 * single entry point every hook and setting change routes through.
 */
export function refreshTicker(): void {
  const shouldRun = haltReason() === null;

  if (!shouldRun) {
    stopTicker();
    return;
  }

  const period = getClockTickSeconds() * 1000;
  // Restart on every refresh so a changed tick interval takes effect immediately.
  stopTicker();
  intervalId = setInterval(() => void tick(), period);
}

export function stopTicker(): void {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

/**
 * No catch-up: time resumes where it stopped rather than jumping forward by the elapsed real time.
 * A silent multi-hour jump after a GM reconnects would be far worse than a stopped clock.
 */
export function tickerIsActive(): boolean {
  return intervalId !== null;
}
