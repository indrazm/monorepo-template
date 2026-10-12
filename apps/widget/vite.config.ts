import { defineConfig, loadEnv } from "vite";

// Builds the public pixel `t.js`: a single IIFE with no runtime dependencies,
// kept under 30 KB gzipped (SRS NFR-PERF-01). The API base URL is baked at
// build time from VITE_API_URL (root .env) and can be overridden per-site with
// a data-api attribute on the script tag.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
  return {
    define: {
      __TACTO_API_URL__: JSON.stringify(env.VITE_API_URL ?? "http://localhost:8000"),
    },
    build: {
      lib: {
        entry: "src/index.ts",
        name: "Tacto",
        fileName: () => "t.js",
        formats: ["iife"],
      },
      minify: "esbuild",
      target: "es2018",
      emptyOutDir: true,
    },
  };
});
