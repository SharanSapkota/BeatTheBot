import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Creates and migrates the test database once before all tests.
    globalSetup: ["./src/test_helpers/global_setup.ts"],
    // Integration tests share one test database, so test files run one at a time.
    fileParallelism: false,
    // Quiet logs in tests. Set LOG_LEVEL in the shell (e.g. LOG_LEVEL=debug) to see them.
    env: { LOG_LEVEL: process.env.LOG_LEVEL ?? "silent" },
  },
});
