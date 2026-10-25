// Words that send a story to full human review (🔴) or flag strong wording for the editor.
// docs/content_generation.md → Escalation words; docs/editorial_rules.md → Traffic light.

/**
 * Injuries, discipline, minors, legal and personal topics: always 🔴. English and Finnish stems
 * (Finnish inflects).
 */
export const ESCALATION_WORDS: readonly string[] = [
  "injur",
  "loukkaant",
  "concussion",
  "aivotärähdys",
  "match penalty",
  "ottelurangaist",
  "game misconduct",
  "pelirangaist",
  "fight",
  "tappelu",
  "suspension",
  "pelikielto",
  "junior",
  "juniori",
  "minor",
  "alaikäi",
  // Legal topics.
  "court",
  "oikeus",
  "police",
  "poliisi",
  "arrest",
  "pidätet",
  "lawsuit",
  "charged",
  "syyte",
  // Personal life.
  "illness",
  "sairas",
  "family",
  "perhe",
  "private life",
  "yksityiselä",
  "divorce",
  "pregnan",
  "raskau",
  "funeral",
  "died",
  "kuoli",
];

/** Phrases that tip or predict a winner: the AI never does that (always 🔴). */
export const TIP_PHRASES: readonly string[] = [
  "will win",
  "will beat",
  "will lose",
  "should win",
  "should beat",
  "going to win",
  "set to win",
  "sure to",
  "bound to",
  "expected to win",
  "expect them to",
  "favourite",
  "favorite",
  "our tip",
  "my tip",
  "tip:",
  "predict",
  "best bet",
  "bet on",
  "back them",
  "can't lose",
  "cannot lose",
  "voittaa varmasti",
  "vinkki",
];

/**
 * Betting language: never near Kaleva's game content (no betting sponsors, no tips). Matched as
 * whole words, so "Veikkausliiga" (the league's name) is not a hit.
 */
export const BETTING_WORDS: readonly string[] = [
  "bet",
  "bets",
  "betting",
  "bettor",
  "bookmaker",
  "bookie",
  "wager",
  "odds-on",
  "accumulator",
  "parlay",
  "free bet",
  "vedonlyönti",
  "kerroin",
];

/** Opinion words that are not facts (the checker can't test tone): flagged for the editor. */
export const STRONG_WORDS: readonly string[] = [
  "dominant",
  "dominat",
  "crisis",
  "disaster",
  "humiliat",
  "embarrass",
  "collapse",
  "kriisi",
  "nöyryyt",
  "romahd",
];

function find_words(text: string, words: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((word) => lower.includes(word));
}

export function find_escalation_words(text: string): string[] {
  return find_words(text, ESCALATION_WORDS);
}

/** Tipping or predicting a winner ("will win", "favourite", "our tip", …). */
export function find_tips(text: string): string[] {
  return find_words(text, TIP_PHRASES);
}

/** Betting language, as whole words ("bet", "bookmaker", "wager", …). */
export function find_betting_words(text: string): string[] {
  const lower = text.toLowerCase();
  return BETTING_WORDS.filter((word) =>
    new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, "u").test(lower),
  );
}

export function find_strong_words(text: string): string[] {
  return find_words(text, STRONG_WORDS);
}
