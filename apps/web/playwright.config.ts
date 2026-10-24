import { defineConfig } from "@playwright/test";

const WEB_URL = "http://localhost:5173";
const API_HEALTH_URL = "http://localhost:3000/api/v1/health";

// Uses the Google Chrome installed on this machine (no browser download).
// The API starts from the repo root so it reads the root .env.
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test_results",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "en-GB",
    timezoneId: "Europe/Helsinki",
  },
  webServer: [
    {
      command: "apps/api/node_modules/.bin/tsx apps/api/src/server.ts",
      cwd: "../..",
      url: API_HEALTH_URL,
      env: { LIVE_SYNC_ENABLED: "false" },
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "pnpm exec vite --port 5173 --strictPort",
      url: WEB_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
