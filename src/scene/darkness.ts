import { MODULE_ID } from "../constants.js";
import { getDarknessProfile, getLatitude } from "../settings.js";
import { getWorldDate } from "../time/pf2e-clock.js";
import { targetScene } from "../weather/scene-sync.js";
import { darknessAt, isWorthWriting } from "./darkness-curve.js";

/**
 * Drives a scene's darkness level from the in-world time.
 *
 * Off unless a scene asks for it: interiors and anything underground outnumber outdoor scenes, and
 * brightening a cave at noon is worse than leaving darkness alone.
 */

const FLAG_DARKNESS_CONTROL = "darknessControl";

/** Long enough to read as a transition, short enough not to lag behind a fast clock. */
const ANIMATION_MS = 4000;

/**
 * Where darkness lives in the Scene schema.
 *
 * v13 deprecated `Scene#darkness` in favour of `darknessLevel`, and v14 nests lighting under
 * `environment` — but the write path is not spelled out in the documentation. Detecting it against
 * a real document beats guessing: writing to a field that does not exist fails silently, which is
 * precisely the failure this module has already been bitten by once.
 */
type DarknessPath = { read: (scene: FoundryScene) => number | undefined; write: string };

const CANDIDATE_PATHS: DarknessPath[] = [
  { read: (scene) => scene.environment?.darknessLevel, write: "environment.darknessLevel" },
  { read: (scene) => scene.darknessLevel, write: "darknessLevel" },
  { read: (scene) => scene.darkness, write: "darkness" },
];

let resolvedPath: DarknessPath | null = null;
let pathResolved = false;

/** Clears the memoised detection. Only needed when the Scene shape under test changes. */
export function resetDarknessPathCache(): void {
  resolvedPath = null;
  pathResolved = false;
}

export function resolveDarknessPath(scene: FoundryScene): DarknessPath | null {
  if (pathResolved) return resolvedPath;
  pathResolved = true;

  resolvedPath = CANDIDATE_PATHS.find((candidate) => typeof candidate.read(scene) === "number") ?? null;

  if (resolvedPath) console.log(`${MODULE_ID} | scene darkness reads and writes "${resolvedPath.write}"`);
  else
    console.warn(
      `${MODULE_ID} | no recognised darkness field on this Scene document; darkness control is disabled. ` +
        `Looked for: ${CANDIDATE_PATHS.map((c) => c.write).join(", ")}`,
    );

  return resolvedPath;
}

export const isDarknessControlled = (scene: FoundryScene): boolean =>
  scene.getFlag(MODULE_ID, FLAG_DARKNESS_CONTROL) === true;

export const setDarknessControlled = (scene: FoundryScene, enabled: boolean): Promise<FoundryScene> =>
  scene.setFlag(MODULE_ID, FLAG_DARKNESS_CONTROL, enabled);

function isActiveGM(): boolean {
  return game.user.isGM && game.users.activeGM?.id === game.user.id;
}

export type DarknessOutcome =
  | { applied: true; level: number; scene: string }
  | { applied: false; reason: string; scene?: string };

/**
 * Brings the viewed scene's darkness in line with the current time.
 *
 * Called on every world time change, so the cheap refusals come first and the write only happens
 * when the value has actually moved.
 */
export async function applySceneDarkness(): Promise<DarknessOutcome> {
  if (!isActiveGM()) return { applied: false, reason: "this client is not the active GM" };

  const scene = targetScene();
  if (!scene) return { applied: false, reason: "no scene is currently in view" };
  if (!isDarknessControlled(scene)) {
    return { applied: false, reason: "the scene does not have darkness control enabled", scene: scene.name };
  }

  // Foundry's own lock is an explicit instruction not to touch this, and outranks our checkbox.
  if (scene.environment?.darknessLock === true) {
    return { applied: false, reason: "the scene's darkness level is locked", scene: scene.name };
  }

  const path = resolveDarknessPath(scene);
  if (!path) return { applied: false, reason: "no darkness field found on the Scene document", scene: scene.name };

  const date = getWorldDate();
  const minuteOfDay = date.hour * 60 + date.minute;
  const next = darknessAt(minuteOfDay, date.dayOfYear, getLatitude(), getDarknessProfile());

  const current = path.read(scene) ?? 0;
  if (!isWorthWriting(current, next)) {
    return { applied: false, reason: "already at the right level", scene: scene.name };
  }

  try {
    await scene.update({ [path.write]: next }, { animateDarkness: ANIMATION_MS });
    return { applied: true, level: next, scene: scene.name };
  } catch (error) {
    console.error(`${MODULE_ID} | could not set scene darkness:`, error);
    return { applied: false, reason: "the scene update failed", scene: scene.name };
  }
}
