#!/usr/bin/env node
/**
 * Assembles the installable module folder.
 *
 * Vite writes the bundle into `dist/<id>/scripts`; this copies the static folders in beside it so
 * the result is a self-contained module directory that can be dropped into Foundry's `modules`
 * folder with nothing else alongside it — no sources, no node_modules, no git history.
 */

import { access, cp, readFile } from "node:fs/promises";
import { join } from "node:path";

const manifest = JSON.parse(await readFile("module.json", "utf8"));
const outDir = join("dist", manifest.id);

const STATIC_PATHS = ["module.json", "styles", "lang", "data"];

for (const path of STATIC_PATHS) {
  await cp(path, join(outDir, path), { recursive: true });
}

/**
 * The manifest points at files by path, and a mismatch between it and the packaged layout produces
 * a module that installs cleanly and then does nothing. Check rather than assume.
 */
const declared = [...(manifest.esmodules ?? []), ...(manifest.styles ?? []), ...(manifest.languages ?? []).map((l) => l.path)];

const missing = [];
for (const relative of declared) {
  try {
    await access(join(outDir, relative));
  } catch {
    missing.push(relative);
  }
}

if (missing.length > 0) {
  console.error(`package: the manifest declares files that are not in the package:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

console.log(`package: ${outDir} ready (${declared.length} declared files present)`);
