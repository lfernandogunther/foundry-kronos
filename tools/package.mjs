#!/usr/bin/env node
/**
 * Assembles the installable module folder.
 *
 * Vite writes the bundle into `dist/<id>/scripts`; this copies the static folders in beside it so
 * the result is a self-contained module directory that can be dropped into Foundry's `modules`
 * folder with nothing else alongside it — no sources, no node_modules, no git history.
 */

import { access, cp, readdir, readFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

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

/**
 * A stylesheet also declares files, in its `url()`s, and a missing one fails differently: the module
 * installs, loads, renders — and draws no icons, with nothing in the console to say why. So the
 * assets the packaged CSS asks for are checked the same way the manifest's are.
 */
async function assetsReferencedBy(cssPath) {
  const css = await readFile(cssPath, "utf8");
  const relative = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]
    .map((match) => match[1].trim())
    .filter((url) => !/^(?:[a-z]+:|\/\/|\/|data:)/i.test(url));

  // Resolved against the stylesheet's own folder, which is how a browser resolves them.
  return relative.map((url) => posix.normalize(posix.join(dirname(cssPath), url)));
}

const missingAssets = [];
for (const stylesheet of manifest.styles ?? []) {
  for (const asset of await assetsReferencedBy(join(outDir, stylesheet))) {
    try {
      await access(asset);
    } catch {
      missingAssets.push(`${asset} (from ${stylesheet})`);
    }
  }
}

if (missingAssets.length > 0) {
  console.error(
    `package: the packaged stylesheets reference files that are not in the package:\n  ${missingAssets.join("\n  ")}`,
  );
  process.exit(1);
}

// Nothing above notices an empty folder, and the assets are the part most likely to be forgotten.
const fontCount = (await readdir(join(outDir, "styles", "fonts")).catch(() => [])).length;

console.log(`package: ${outDir} ready (${declared.length} declared files, ${fontCount} fonts)`);
