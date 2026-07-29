import { MODULE_ID } from "../constants.js";

const t = (key: string): string => game.i18n?.localize(key) ?? key;

/**
 * Warns when something else is also driving scene darkness.
 *
 * Three things can: PF2e's own World Clock sync, SmallTime, and us. Two of them writing produces a
 * scene that flickers between two opinions, and nothing in the behaviour points at the cause. We
 * neither disable ourselves nor switch the other off — both would be surprising — but the clash is
 * named rather than left to be diagnosed from symptoms.
 */
export function warnAboutDarknessConflicts(scene: FoundryScene): void {
  if (!game.user.isGM) return;

  const rivals: string[] = [];

  const pf2eSyncsDarkness = ((): boolean => {
    try {
      return game.settings.get("pf2e", "worldClock.syncDarkness") === true;
    } catch {
      return false;
    }
  })();
  if (pf2eSyncsDarkness) rivals.push(t("KRONOS.Conflict.Pf2eSyncDarkness"));

  // SmallTime keeps its per-scene darkness link in its own flag on the scene.
  const smallTimeActive = game.modules?.get?.("smalltime")?.active === true;
  if (smallTimeActive && scene.getFlag("smalltime", "darkness-control") === true) {
    rivals.push(t("KRONOS.Conflict.SmallTime"));
  }

  if (rivals.length === 0) return;

  const message = game.i18n?.format("KRONOS.Conflict.Warning", { others: rivals.join(", ") });
  console.warn(`${MODULE_ID} | ${message ?? rivals.join(", ")}`);
  ui.notifications?.warn(message ?? rivals.join(", "), { permanent: true });
}
