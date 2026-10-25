import type { FactSheet, FailedClaim } from "@voita_kone/fact_checker";
import { FACT_SHEET_END, FACT_SHEET_START } from "../../integrations/llm_client/llm_client";

// The AI preview and AI summary prompts (docs/content_generation.md → Prompt rules). A change to
// the text is a new PROMPT_VERSION, stored with every story.

export type GeneratedStoryType = "preview" | "summary";

export const PROMPT_VERSIONS: Record<GeneratedStoryType, string> = {
  preview: "preview_en_v2",
  summary: "summary_en_v2",
};
export const TEMPLATE_VERSIONS: Record<GeneratedStoryType, string> = {
  preview: "preview_template_v3",
  summary: "summary_template_v3",
};
/** Word limits the output check enforces (step 10). */
export const WORD_LIMITS: Record<GeneratedStoryType, { min: number; max: number }> = {
  preview: { min: 25, max: 70 },
  summary: { min: 60, max: 90 },
};
export const STORY_MAX_TOKENS = 2000;

export const SYSTEM_PROMPT = [
  "You are a friendly, neutral sports reporter for Kaleva, a Finnish regional newspaper. You write about Finnish sports (Liiga ice hockey, football, basketball) for fans. The AI explains; it never competes or tips.",
  "Rules:",
  "1. Use ONLY facts from the fact sheet. Never add a number, name, date, result or claim that is not in the sheet.",
  "2. End every sentence or bullet that states a fact with its fact ids in brackets, e.g. [f3] or [f3, f4].",
  "3. Never tip, predict or favour a winner. Do not write 'will win', 'should win', 'favourite', 'expect' or similar. Give probabilities only as 'Data says Kärpät have a 62% chance'.",
  "4. No injuries, discipline, legal matters, private life, quotes or opinions about players.",
  "4b. No betting language at all: no bets, odds tips, bookmakers, wagers or 'sure things'.",
  "5. Simple English and short sentences. Write numbers as digits and percentages as whole numbers with %.",
  "6. If facts are missing, write less. Never fill gaps.",
].join("\n");

const TASKS: Record<GeneratedStoryType, string> = {
  preview:
    "Write the AI preview of this upcoming game: exactly 3 bullet lines that start with '- ', then one line that starts with 'Why it matters: '. At most 70 words in total. " +
    "Bullet 1: form (and the home or away record, the player in form). Bullet 2: earlier meetings and this season's series. Bullet 3: the table and, if the sheet has it, what the data says. " +
    "Why it matters: what is at stake (the stake facts), or how close the teams are in the table.",
  summary:
    "Write the AI summary of this finished game: one paragraph of 60–90 words. " +
    "The result and the scorers, the winning goal, a comeback or lead changes if the sheet has them, what it means for the table (and the season odds if given), and the next game.",
};

export function build_story_prompt(
  story_type: GeneratedStoryType,
  sheet: FactSheet,
  problems: readonly FailedClaim[],
): string {
  const lines = [TASKS[story_type], "", FACT_SHEET_START + JSON.stringify(sheet) + FACT_SHEET_END];
  if (problems.length > 0) {
    lines.push(
      "",
      "Your previous version broke the rules. Remove or fix these parts:",
      ...problems.map((problem) => `- "${problem.claim}": ${problem.reason}`),
    );
  }
  return lines.join("\n");
}
