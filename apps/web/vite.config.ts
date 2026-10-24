import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Read VITE_* variables from the shared .env in the repo root.
  envDir: "../..",
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test_setup.ts"],
    // Playwright specs in e2e/ run with `pnpm --filter web e2e`, not Vitest.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
