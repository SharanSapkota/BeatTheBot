import type { z } from "zod";

// localStorage can be missing or throw (private mode, blocked storage), so every access is
// guarded and the app keeps working without it.

const KEY_PREFIX = "voita_kaleva_";
// Keys saved before the rename to "Voita Kaleva" (e.g. voita_kone_session). Moved once, so
// signed-in users stay signed in and keep their picks.
const LEGACY_KEY_PREFIX = "voita_kone_";
let legacy_keys_moved = false;

function move_legacy_keys(): void {
  if (legacy_keys_moved) {
    return;
  }
  legacy_keys_moved = true;
  try {
    const storage = window.localStorage;
    const legacy_keys = Object.keys(storage).filter((key) => key.startsWith(LEGACY_KEY_PREFIX));
    for (const legacy_key of legacy_keys) {
      const key = KEY_PREFIX + legacy_key.slice(LEGACY_KEY_PREFIX.length);
      const value = storage.getItem(legacy_key);
      if (value !== null && storage.getItem(key) === null) {
        storage.setItem(key, value);
      }
      storage.removeItem(legacy_key);
    }
  } catch {
    // Storage blocked: nothing to move.
  }
}

/** Lets tests move legacy keys again after changing localStorage. */
export function reset_legacy_key_move(): void {
  legacy_keys_moved = false;
}

export function read_stored<T extends z.ZodType>(key: string, schema: T): z.infer<T> | null {
  move_legacy_keys();
  try {
    const text = window.localStorage.getItem(KEY_PREFIX + key);
    if (text === null) {
      return null;
    }
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function write_stored(key: string, value: unknown): void {
  move_legacy_keys();
  try {
    window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the pick still works for this visit.
  }
}

export function remove_stored(key: string): void {
  move_legacy_keys();
  try {
    window.localStorage.removeItem(KEY_PREFIX + key);
  } catch {
    // Nothing to do.
  }
}
