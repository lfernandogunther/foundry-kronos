#!/usr/bin/env node
/**
 * Copies the packaged module into a Foundry data directory.
 *
 * Give the path with FOUNDRY_DATA (the "User Data Path" from Foundry's setup screen), or let it
 * try the usual locations:
 *
 *   FOUNDRY_DATA=~/Library/Application\ Support/FoundryVTT npm run install:foundry
 */

import { access, cp, readFile, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const manifest = JSON.parse(await readFile("module.json", "utf8"));
const source = join("dist", manifest.id);

try {
  await access(join(source, "module.json"));
} catch {
  console.error(`install: ${source} has not been built yet — run "npm run build" first.`);
  process.exit(1);
}

const CANDIDATES = [
  process.env["FOUNDRY_DATA"],
  join(homedir(), "Library", "Application Support", "FoundryVTT"),
  join(homedir(), ".local", "share", "FoundryVTT"),
  join(homedir(), "FoundryVTT"),
].filter(Boolean);

/** A data directory is the one containing `Data/modules`, whatever it is called. */
async function modulesDirIn(root) {
  for (const candidate of [join(root, "Data", "modules"), join(root, "modules")]) {
    try {
      if ((await stat(candidate)).isDirectory()) return candidate;
    } catch {
      // Not this one.
    }
  }
  return null;
}

let modulesDir = null;
for (const candidate of CANDIDATES) {
  modulesDir = await modulesDirIn(candidate);
  if (modulesDir) break;
}

if (!modulesDir) {
  console.error(
    "install: could not find a Foundry modules folder.\n" +
      "Set FOUNDRY_DATA to the User Data Path shown in Foundry's setup screen, for example:\n" +
      '  FOUNDRY_DATA="$HOME/Library/Application Support/FoundryVTT" npm run install:foundry\n' +
      `Looked in:\n  ${CANDIDATES.join("\n  ")}`,
  );
  process.exit(1);
}

const target = join(modulesDir, manifest.id);

/**
 * Refuses to replace a directory that is not a previous install of this module. Overwriting is
 * destructive and the target sits among every other module the user has installed.
 */
const targetExists = await stat(target).then(
  () => true,
  () => false,
);

if (targetExists) {
  const existingId = await readFile(join(target, "module.json"), "utf8")
    .then((raw) => JSON.parse(raw).id)
    .catch(() => null);

  if (existingId !== manifest.id) {
    const what = existingId === null ? "no readable module.json" : `module "${existingId}"`;
    console.error(`install: ${target} already exists and holds ${what}. Not touching it — remove it by hand first.`);
    process.exit(1);
  }

  // Replaced rather than merged, so files dropped from a later version do not linger.
  await rm(target, { recursive: true });
}

await cp(source, target, { recursive: true });
console.log(`install: ${manifest.title} ${manifest.version} -> ${target}`);
console.log("Reload Foundry, then enable it under Manage Modules.");
