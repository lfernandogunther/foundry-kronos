#!/usr/bin/env node
/**
 * Zips the packaged module folder into the archive a manifest-URL install downloads.
 *
 * Foundry fetches `module.json` from the manifest URL, reads `download` out of it, and expects that
 * to be a zip whose files sit at the archive root. `dist/<id>/` already has exactly that layout, so
 * the archive is built from inside it rather than of it — zipping the folder itself would nest
 * everything one level down and Foundry would find no manifest.
 */

import { spawnSync } from "node:child_process";
import { access, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const manifest = JSON.parse(await readFile("module.json", "utf8"));
const packaged = join("dist", manifest.id);
const archive = join("dist", `${manifest.id}.zip`);

try {
  await access(join(packaged, "module.json"));
} catch {
  console.error(`release: ${packaged} has not been built yet — run "npm run build" first.`);
  process.exit(1);
}

/**
 * The tag names the release, and the release URL is what `download` points at. A tag that does not
 * match the manifest version publishes a release whose own manifest tells Foundry to fetch a zip
 * from a different release — usually a 404, and never the code that was just tagged.
 */
const tag = process.env["RELEASE_TAG"];
if (tag && tag !== `v${manifest.version}`) {
  console.error(`release: tag ${tag} does not match module.json version ${manifest.version}. Bump one to match the other.`);
  process.exit(1);
}

// zip updates an existing archive in place, which would keep entries for files a later build
// dropped. Start from nothing so the archive always matches the folder.
await rm(archive, { force: true });

const result = spawnSync("zip", ["--recurse-paths", "-X", join("..", `${manifest.id}.zip`), ".", "-x", "*.DS_Store", "-x", "__MACOSX/*"], {
  cwd: packaged,
  stdio: "inherit",
});

if (result.error) {
  const why = result.error.code === "ENOENT" ? "the zip command is not installed" : result.error.message;
  console.error(`release: could not create the archive — ${why}.`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`release: zip exited with status ${result.status}.`);
  process.exit(1);
}

const { size } = await stat(archive);
console.log(`release: ${archive} ready (${(size / 1024).toFixed(0)} kB) for ${manifest.download}`);
