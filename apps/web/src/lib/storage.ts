import type { z } from "zod";

// localStorage can be missing or throw (private mode, blocked storage), so every access is
// guarded and the app keeps working without it.

const KEY_PREFIX = "voita_kone_";

export function read_stored<T extends z.ZodType>(key: string, schema: T): z.infer<T> | null {
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
  try {
    window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the pick still works for this visit.
  }
}

export function remove_stored(key: string): void {
  try {
    window.localStorage.removeItem(KEY_PREFIX + key);
  } catch {
    // Nothing to do.
  }
}
