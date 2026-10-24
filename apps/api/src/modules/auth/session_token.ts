import { createHash, randomBytes, randomUUID } from "node:crypto";

const TOKEN_BYTES = 32;

/** A new random session token (sent to the client once, never stored). */
export function generate_session_token(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Only this hash of the token is stored in `sessions.token_hash`. */
export function hash_session_token(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The random subject of a new device identity. */
export function generate_device_subject(): string {
  return randomUUID();
}
