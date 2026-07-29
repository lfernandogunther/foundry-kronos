import { MODULE_ID, REQUIRED_SYSTEM } from "./constants.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
});

Hooks.once("ready", () => {
  if (game.system.id !== REQUIRED_SYSTEM) {
    // Every date we display comes from the PF2e World Clock, so on another system there is
    // nothing to show. Say so once rather than failing obscurely later.
    ui.notifications?.warn(
      `${MODULE_ID}: requires the ${REQUIRED_SYSTEM} system, found "${game.system.id}". The calendar bar is disabled.`,
    );
    return;
  }

  console.log(`${MODULE_ID} | ready on ${game.system.id} ${game.system.version}`);
});
