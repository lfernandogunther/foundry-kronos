import { defineConfig } from "vite";

// The repository folder *is* the module folder: Foundry loads dist/module.js while
// templates/, styles/, lang/ and data/ are served from the repo root as-is. That keeps
// the build to a single JS bundle and avoids a copy plugin.
export default defineConfig({
  build: {
    outDir: "dist",
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
