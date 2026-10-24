import { randomInt } from "node:crypto";
import { JOIN_KEY_ALPHABET, JOIN_KEY_LENGTH } from "@voita_kone/shared_types";
import { AppError } from "../../common/app_error";

// Join keys: 6 characters from an alphabet without 0/O/1/I/L ("K7RP4T"). Random from the crypto
// generator, so keys can't be guessed from each other. Keys are never logged.

/** How many keys to try before giving up (a clash is already rare at 31^6 ≈ 887 million). */
export const JOIN_KEY_ATTEMPTS = 10;

/** Returns a random index in [0, max). Injected in tests. */
export type RandomIndex = (max: number) => number;

export function generate_join_key(random_index: RandomIndex = randomInt): string {
  let key = "";
  for (let position = 0; position < JOIN_KEY_LENGTH; position += 1) {
    key += JOIN_KEY_ALPHABET[random_index(JOIN_KEY_ALPHABET.length)] ?? "";
  }
  return key;
}

/**
 * Tries new keys until `try_save` succeeds (it returns undefined when the key is taken, e.g. on
 * the unique constraint). Throws 500 KEY_GENERATION_FAILED after JOIN_KEY_ATTEMPTS clashes.
 */
export async function with_unique_join_key<T>(
  try_save: (key: string) => Promise<T | undefined>,
  generate: () => string = generate_join_key,
): Promise<T> {
  for (let attempt = 0; attempt < JOIN_KEY_ATTEMPTS; attempt += 1) {
    const saved = await try_save(generate());
    if (saved !== undefined) {
      return saved;
    }
  }
  throw new AppError("KEY_GENERATION_FAILED", 500, "Could not create a join key. Try again.");
}
