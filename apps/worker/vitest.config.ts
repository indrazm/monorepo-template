import { defineConfig } from "vitest/config";

// The processor suite applies migrations to an in-memory pglite in beforeAll.
// Under parallel workspace test runs that can exceed the default hook timeout.
export default defineConfig({
  test: {
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
