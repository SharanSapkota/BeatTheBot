// Finds the checkable pieces (claims) in a text with rules: regular expressions and name lists.

export type ClaimType =
  "percent" | "score" | "date" | "game_time" | "ordinal" | "weekday" | "number" | "name";

export interface Claim {
  type: ClaimType;
  /** The text as written, e.g. "27%" or "3–1". */
  text: string;
  start: number;
  end: number;
}

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

// Most specific first: a date's digits must not also count as a score or a number.
const PATTERNS: readonly { type: ClaimType; pattern: RegExp }[] = [
  { type: "date", pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
  { type: "date", pattern: new RegExp(`\\b\\d{1,2} (?:${MONTHS})[a-z]*\\b`, "gi") },
  { type: "date", pattern: /\b\d{1,2}\.\d{1,2}\.(?!\d)/g },
  { type: "percent", pattern: /\d{1,3}(?:[.,]\d+)?\s?(?:%|per ?cent\b|prosenttia\b)/gi },
  { type: "score", pattern: /\b\d{1,2}\s?[–—-]\s?\d{1,2}\b/g },
  { type: "game_time", pattern: /\b\d{1,3}:\d{2}\b/g },
  { type: "ordinal", pattern: /\b\d{1,2}(?:st|nd|rd|th)\b/gi },
  { type: "weekday", pattern: new RegExp(`\\b(?:${WEEKDAYS.join("|")})\\b`, "g") },
  { type: "number", pattern: /\b\d+(?:[.,]\d+)?\b/g },
];

function overlaps(claim: { start: number; end: number }, taken: readonly Claim[]): boolean {
  return taken.some((other) => claim.start < other.end && other.start < claim.end);
}

function escape_regex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A name as a whole word: "Kärpät's" matches "Kärpät", "Kärpätin" does not. */
export function name_pattern(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape_regex(name)}(?![\\p{L}\\p{N}])`, "gu");
}

/**
 * All claims in the text, in text order. Names are found first (longest first, so a full
 * name wins over the last name alone), then numbers and other patterns.
 */
export function extract_claims(text: string, names: readonly string[]): Claim[] {
  const claims: Claim[] = [];
  const longest_first = [...new Set(names)].sort((first, second) => second.length - first.length);
  for (const name of longest_first) {
    for (const match of text.matchAll(name_pattern(name))) {
      const claim = {
        type: "name" as const,
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      };
      if (!overlaps(claim, claims)) {
        claims.push(claim);
      }
    }
  }
  for (const { type, pattern } of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const claim = {
        type,
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      };
      if (!overlaps(claim, claims)) {
        claims.push(claim);
      }
    }
  }
  return claims.sort((first, second) => first.start - second.start);
}

/** Capitalised words that start sentences or name things that are not people. */
const NOT_PERSON_WORDS = new Set([
  ...WEEKDAYS,
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "Liiga",
  "Kaleva",
  "Data",
  "The",
  "A",
  "An",
  "In",
  "On",
  "At",
  "After",
  "Before",
  "Next",
  "Last",
  "Their",
  "They",
  "This",
  "That",
  "Both",
  "With",
  "When",
  "Then",
  "But",
  "And",
  "Fans",
  "Home",
  "Away",
  "Top",
  "Since",
  "Over",
  "Up",
  "It",
  "Its",
]);

const PERSON_PATTERN = /(?<![\p{L}\p{N}])\p{Lu}[\p{Ll}'’-]+(?:\s+\p{Lu}[\p{Ll}'’-]+)+/gu;

/**
 * Person-like names ("Matti Virtanen") that no known player or team has: two or more
 * capitalised words in a row, none of them a known name or a common capitalised word.
 */
export function find_unknown_person_names(
  text: string,
  names: readonly string[],
  claims: readonly Claim[],
): string[] {
  const known_words = new Set(names.flatMap((name) => name.split(/\s+/)));
  const found: string[] = [];
  for (const match of text.matchAll(PERSON_PATTERN)) {
    const span = { start: match.index, end: match.index + match[0].length };
    const words = match[0].split(/\s+/);
    const is_known = words.some((word) => known_words.has(word) || NOT_PERSON_WORDS.has(word));
    if (!is_known && !overlaps(span, claims)) {
      found.push(match[0]);
    }
  }
  return found;
}
