import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { find_api_base_url_problem } from "./src/lib/build_env";

// Read VITE_* variables from the shared .env in the repo root (and from the shell, e.g. Vercel).
const ENV_DIR = "../..";

export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") {
    const problem = find_api_base_url_problem(loadEnv(mode, ENV_DIR, "VITE_").VITE_API_BASE_URL);
    if (problem) {
      throw new Error(problem);
    }
  }

  return {
    plugins: [react()],
    envDir: ENV_DIR,
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
  };
});
