import type { Response } from "express";

/** Short cache for data that changes rarely; Express adds a weak ETag to every JSON body. */
export const SHORT_MAX_AGE_SECONDS = 60;

/**
 * Live data must never be cached (the PWA's NetworkFirst falls back to cache only offline).
 * Everything else may be cached briefly and revalidated with the ETag (304).
 */
export function set_cache_control(res: Response, live: boolean): void {
  res.set("Cache-Control", live ? "no-store" : `public, max-age=${String(SHORT_MAX_AGE_SECONDS)}`);
}
