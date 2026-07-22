import { defineConfig } from "vitest/config";

// PostgreSQL integration tests (added in the DB step) must run serially against
// a single shared database, so parallelism is disabled up front.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
