import {
  classify_claims,
  find_escalation_words,
  find_strong_words,
  find_tips,
  find_unknown_fact_ids,
  strip_fact_ids,
  type ClassifiedClaim,
  type FactSheet,
  type FailedClaim,
  type KnownName,
} from "@voita_kone/fact_checker";
import { LlmUnavailableError, type LlmClient } from "../../integrations/llm_client/llm_client";
import {
  PROMPT_VERSIONS,
  STORY_MAX_TOKENS,
  SYSTEM_PROMPT,
  TEMPLATE_VERSIONS,
  build_story_prompt,
  type GeneratedStoryType,
} from "./story_prompt";
import { template_preview, template_summary } from "./story_templates";
import { decide_traffic_light, type TrafficLight } from "./traffic_light";

// fact sheet → prompt → LLM → check every claim → retry (max 2) → traffic light. Without an
// LLM (no key, provider down) the template from the same sheet is used. Pure apart from the LLM.

/** The first try plus at most 2 retries with the problems listed. */
export const MAX_GENERATION_ATTEMPTS = 3;
export const TEMPLATE_MODEL_NAME = "template";
const MIN_WORDS = 40;
const MAX_WORDS = 130;
const PREVIEW_BULLETS = 3;

export interface CheckDetails {
  claims: ClassifiedClaim[];
  tips: string[];
  escalation_words: string[];
  strong_words: string[];
  llm_error: string | null;
  traffic_light_reasons: string[];
}

export interface WrittenStory {
  body: string;
  raw_output: string;
  model_name: string;
  source: "llm" | "template";
  prompt_version: string;
  attempts: number;
  traffic_light: TrafficLight;
  check: CheckDetails;
}

function word_count(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Empty, too short or long, or (preview) not 3 bullets: the LLM's answer is unusable. */
export function output_problem(story_type: GeneratedStoryType, body: string): string | null {
  const words = word_count(body);
  if (words === 0) {
    return "empty answer";
  }
  if (words < MIN_WORDS || words > MAX_WORDS) {
    return `${String(words)} words (expected about 60–90)`;
  }
  if (story_type === "preview") {
    const bullets = body.split("\n").filter((line) => line.trim().startsWith("-")).length;
    if (bullets !== PREVIEW_BULLETS) {
      return `${String(bullets)} bullets (expected 3)`;
    }
  }
  return null;
}

/** Checks one text (raw, with fact ids) and decides its traffic light. */
export function check_text(
  story_type: string,
  raw: string,
  sheet: FactSheet,
  known_names: readonly KnownName[],
  llm_error: string | null,
): { traffic_light: TrafficLight; check: CheckDetails } {
  const body = strip_fact_ids(raw);
  const unknown_ids: ClassifiedClaim[] = find_unknown_fact_ids(raw, sheet).map((fact_id) => ({
    claim: `[${fact_id}]`,
    type: "number",
    status: "wrong",
    fact_ids: [],
    reason: "cites a fact that is not in the fact sheet",
  }));
  const claims = [...classify_claims(raw, sheet, known_names), ...unknown_ids];
  const tips = find_tips(body);
  const escalation_words = find_escalation_words(body);
  const decision = decide_traffic_light({ story_type, claims, tips, escalation_words, llm_error });
  return {
    traffic_light: decision.traffic_light,
    check: {
      claims,
      tips,
      escalation_words,
      strong_words: find_strong_words(body),
      llm_error,
      traffic_light_reasons: decision.reasons,
    },
  };
}

function problems_of(check: CheckDetails): FailedClaim[] {
  return [
    ...(check.llm_error
      ? [{ claim: "format", type: "number" as const, reason: check.llm_error }]
      : []),
    ...check.claims
      .filter((claim) => claim.status !== "verified")
      .map((claim) => ({ claim: claim.claim, type: claim.type, reason: claim.reason ?? "" })),
    ...check.tips.map((tip) => ({ claim: tip, type: "name" as const, reason: "tips a winner" })),
    ...check.escalation_words.map((word) => ({
      claim: word,
      type: "name" as const,
      reason: "sensitive topic",
    })),
  ];
}

export function write_template(
  story_type: GeneratedStoryType,
  sheet: FactSheet,
  known_names: readonly KnownName[],
): WrittenStory {
  const body = story_type === "preview" ? template_preview(sheet) : template_summary(sheet);
  return {
    body,
    raw_output: body,
    model_name: TEMPLATE_MODEL_NAME,
    source: "template",
    prompt_version: TEMPLATE_VERSIONS[story_type],
    attempts: 0,
    ...check_text(story_type, body, sheet, known_names, null),
  };
}

export async function write_story(
  llm: LlmClient | undefined,
  story_type: GeneratedStoryType,
  sheet: FactSheet,
  known_names: readonly KnownName[],
): Promise<WrittenStory> {
  if (!llm) {
    return write_template(story_type, sheet, known_names);
  }
  let problems: FailedClaim[] = [];
  let written: WrittenStory | undefined;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await llm.complete({
        system: SYSTEM_PROMPT,
        prompt: build_story_prompt(story_type, sheet, problems),
        max_tokens: STORY_MAX_TOKENS,
      });
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        return write_template(story_type, sheet, known_names);
      }
      throw error;
    }
    const body = strip_fact_ids(response.text);
    const result = check_text(
      story_type,
      response.text,
      sheet,
      known_names,
      output_problem(story_type, body),
    );
    written = {
      body: body.length > 0 ? body : "(the LLM returned no text)",
      raw_output: response.text,
      model_name: response.model_name,
      source: "llm",
      prompt_version: PROMPT_VERSIONS[story_type],
      attempts: attempt,
      ...result,
    };
    problems = problems_of(result.check);
    if (problems.length === 0) {
      break;
    }
  }
  if (!written) {
    throw new Error("No generation attempt ran");
  }
  return written;
}
