import { defineConfig } from "vitest/config";

// Integration suites each spin up an in-memory pglite and apply migrations in
// beforeAll. Under parallel execution on a loaded machine that can exceed the
// default 10s hook timeout, so we raise the hook/test timeouts.
export default defineConfig({
  test: {
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
