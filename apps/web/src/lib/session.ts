import { useSyncExternalStore } from "react";
import { z } from "zod";
import { read_stored, remove_stored, write_stored } from "./storage";

// The device account's session token (docs/architecture.md → Accounts). Stored in
// localStorage as `voita_kaleva_session` (moved once from the old `voita_kone_session`, see
// storage.ts) and sent as `Authorization: Bearer <token>`.

const SESSION_KEY = "session";
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function read_session_token(): string | null {
  return read_stored(SESSION_KEY, z.string().min(1));
}

export function save_session_token(token: string): void {
  write_stored(SESSION_KEY, token);
  notify();
}

/** Signs out on this device (also when the server says the token is no longer valid). */
export function clear_session_token(): void {
  remove_stored(SESSION_KEY);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current token, or null when signed out. Re-renders on sign-in and sign-out. */
export function useSessionToken(): string | null {
  return useSyncExternalStore(subscribe, read_session_token);
}
