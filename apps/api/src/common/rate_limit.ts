import type { RequestHandler } from "express";
import { AppError } from "./app_error";
import type { Clock } from "./clock";

export interface RateLimitOptions {
  /** Requests allowed per client IP in one window. */
  max_requests: number;
  window_ms: number;
  clock: Clock;
}

/**
 * A small fixed-window limit per client IP, kept in memory (one API process in the MVP).
 * Throws 429 RATE_LIMITED when the IP has used up its window.
 */
export function create_rate_limit({
  max_requests,
  window_ms,
  clock,
}: RateLimitOptions): RequestHandler {
  const windows = new Map<string, { started_at: number; count: number }>();

  return (req, _res, next) => {
    const now = clock().getTime();
    const key = req.ip ?? "unknown";
    const current = windows.get(key);
    if (!current || now - current.started_at >= window_ms) {
      windows.set(key, { started_at: now, count: 1 });
      next();
      return;
    }
    if (current.count >= max_requests) {
      throw new AppError("RATE_LIMITED", 429, "Too many requests. Try again in a moment.");
    }
    current.count += 1;
    next();
  };
}
