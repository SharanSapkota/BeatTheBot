import { randomUUID } from "node:crypto";

// Fairness: candidate order is random per user. A signed-in user always gets the same order
// (seed = user_id + election_id); anonymous users get a new random order per visit.
// Pure apart from the anonymous seed, so the order is tested without a database.

/** 32-bit FNV-1a hash of the seed text. */
function hash_seed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small seeded random number generator, numbers in [0, 1). */
function seeded_random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed for a user and election; a fresh random seed for an anonymous visit. */
export function order_seed(user_id: string | null, election_id: string): string {
  return user_id === null ? randomUUID() : `${user_id}:${election_id}`;
}

/** Fisher–Yates shuffle with a seeded generator. The same seed always gives the same order. */
export function order_candidates<T>(candidates: readonly T[], seed: string): T[] {
  const random = seeded_random(hash_seed(seed));
  const ordered = [...candidates];
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const kept = ordered[index] as T;
    ordered[index] = ordered[other] as T;
    ordered[other] = kept;
  }
  return ordered;
}
