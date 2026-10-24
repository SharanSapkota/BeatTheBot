// Words that send a story to full human review (🔴) or flag strong wording for the editor.
// docs/content_generation.md → Escalation words; docs/editorial_rules.md → Traffic light.

/** Injuries, discipline and minors: always 🔴. English and Finnish stems (Finnish inflects). */
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

export function find_strong_words(text: string): string[] {
  return find_words(text, STRONG_WORDS);
}
