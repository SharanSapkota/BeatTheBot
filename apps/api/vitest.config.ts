import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Creates and migrates the test database once before all tests.
    globalSetup: ["./src/test_helpers/global_setup.ts"],
    // Integration tests share one test database, so test files run one at a time.
    fileParallelism: false,
  },
});
