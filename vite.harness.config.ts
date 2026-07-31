import { defineConfig } from "vite";

/**
 * Dev server for the panel harness — `npm run harness`.
 *
 * Rooted at the repository rather than at the harness folder, so the page can reach both `/src` and
 * `/styles` by absolute path. That is what lets it load the module's actual stylesheet, with the
 * relative font URL inside it resolving the same way Foundry resolves it.
 *
 * No build step: the page imports the TypeScript straight out of `src/` and reloads on save. This is
 * a development tool and never ships — `tools/` is not among the folders the packaging step copies.
 *
 * Opening a browser is the npm script's job, not this file's, so running vite directly against this
 * config does not hijack a window.
 */
export default defineConfig({
  root: ".",
});
