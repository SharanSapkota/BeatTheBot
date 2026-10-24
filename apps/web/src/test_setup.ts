import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { clear_picks_cache } from "./lib/picks";
import { reset_legacy_key_move } from "./lib/storage";

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test/api/v1");
  window.localStorage.clear();
  reset_legacy_key_move();
  clear_picks_cache();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
