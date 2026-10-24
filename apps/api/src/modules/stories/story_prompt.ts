import type { FactSheet, FailedClaim } from "@voita_kone/fact_checker";
import { FACT_SHEET_END, FACT_SHEET_START } from "../../integrations/llm_client/llm_client";

// The "what it means" prompt (docs/content_generation.md → Prompt rules). A change to the
// text is a new PROMPT_VERSION, stored with every story.

export const PROMPT_VERSION = "what_it_means_en_v1";
export const STORY_TEMPERATURE = 0.2;
export const STORY_MAX_TOKENS = 400;

export const SYSTEM_PROMPT = [
  "You write short sports news for Kaleva, a Finnish regional newspaper, about Liiga ice hockey.",
  "Rules:",
  "1. Use only facts from the fact sheet. Do not add any other numbers, names, dates or events.",
  "2. End every sentence that states a fact with its fact ids in brackets, e.g. [f3] or [f3, f4].",
  "3. Predictions are probabilities, never certainties: '27% chance', not 'will be relegated'.",
  "4. Neutral tone. No mocking, no blame on individual players, no speculation about injuries or private life.",
  "5. Write in English. Short sentences. 60–100 words. No headline: it is added separately.",
  "6. If facts are missing, write less. Never fill gaps. Never write quotes.",
].join("\n");

export function build_story_prompt(
  sheet: FactSheet,
  failed_claims: readonly FailedClaim[],
): string {
  const lines = [
    "Write the 'What it means' story for this finished game: what the result means for both teams.",
    "",
    FACT_SHEET_START + JSON.stringify(sheet) + FACT_SHEET_END,
  ];
  if (failed_claims.length > 0) {
    lines.push(
      "",
      "Your previous version had claims that are not in the fact sheet. Remove or fix them:",
      ...failed_claims.map((failure) => `- "${failure.claim}": ${failure.reason}`),
    );
  }
  return lines.join("\n");
}
