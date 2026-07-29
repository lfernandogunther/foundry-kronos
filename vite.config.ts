import { defineConfig } from "vite";

import { MODULE_ID } from "./src/constants.js";

/**
 * Builds the JavaScript into the packaged module folder that Foundry will load, laid out the way
 * a hand-written module is: `module.json` at the root beside `scripts/`, `styles/`, `lang/` and
 * `data/`. The static folders are copied in afterwards by the packaging step.
 */
export default defineConfig({
  build: {
    outDir: `dist/${MODULE_ID}/scripts`,
    emptyOutDir: true,
    sourcemap: true,
    // Foundry ships readable module code; minifying only makes console errors harder to trace.
    minify: false,
    lib: {
      entry: "src/module.ts",
      formats: ["es"],
      fileName: () => "module.js",
    },
  },
});
