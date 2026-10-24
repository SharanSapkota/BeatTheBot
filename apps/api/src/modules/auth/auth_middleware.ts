import type { RequestHandler } from "express";
import { set_auth, unauthorized } from "./auth_context";
import type { AuthService } from "./auth_service";

const BEARER_PREFIX = "Bearer ";

/**
 * Reads `Authorization: Bearer <token>` (never cookies, so the embed works on other domains).
 * No header = anonymous request; a bad, revoked or expired token = 401 UNAUTHORIZED.
 */
export function create_auth_middleware(auth_service: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get("authorization");
    if (header === undefined) {
      next();
      return;
    }
    if (!header.startsWith(BEARER_PREFIX) || header.length === BEARER_PREFIX.length) {
      throw unauthorized();
    }
    set_auth(req, await auth_service.authenticate(header.slice(BEARER_PREFIX.length).trim()));
    next();
  };
}
