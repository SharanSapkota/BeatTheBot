import type { Request } from "express";
import type { UserRole } from "@voita_kone/shared_types";
import { AppError } from "../../common/app_error";

/** The signed-in user of a request, set by the auth middleware. */
export interface AuthContext {
  user_id: string;
  session_id: string;
  display_name: string;
  role: UserRole;
}

// Kept beside the request instead of on it, so Express' types stay untouched.
const contexts = new WeakMap<Request, AuthContext>();

export function set_auth(req: Request, context: AuthContext): void {
  contexts.set(req, context);
}

/** The signed-in user, or undefined for an anonymous request. */
export function find_auth(req: Request): AuthContext | undefined {
  return contexts.get(req);
}

export function unauthorized(): AppError {
  return new AppError("UNAUTHORIZED", 401, "Sign in to do this");
}

/** The signed-in user; throws 401 UNAUTHORIZED for an anonymous request. */
export function require_auth(req: Request): AuthContext {
  const context = find_auth(req);
  if (!context) {
    throw unauthorized();
  }
  return context;
}

/** The signed-in user with one of the roles; 401 when anonymous, 403 FORBIDDEN otherwise. */
export function require_role(req: Request, roles: readonly UserRole[]): AuthContext {
  const context = require_auth(req);
  if (!roles.includes(context.role)) {
    throw new AppError("FORBIDDEN", 403, "You don't have access to this");
  }
  return context;
}
