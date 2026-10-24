import type { ClassifiedClaim } from "@voita_kone/fact_checker";

// docs/editorial_rules.md → Traffic light for AI previews and summaries.
// 🟢 every claim verified → auto-publish · 🟡 something not found or a new story type → one-tap
// editor approval · 🔴 a wrong claim, a tip, a sensitive topic or an LLM error → full review.

export type TrafficLight = "green" | "yellow" | "red";

const TRAFFIC_LIGHTS: readonly TrafficLight[] = ["green", "yellow", "red"];

/** Story types with a track record; any other type waits for an editor. */
export const AUTO_PUBLISH_STORY_TYPES: readonly string[] = ["preview", "summary"];

/** A stored value; anything unknown is treated as red (full review). */
export function to_traffic_light(value: string): TrafficLight {
  return TRAFFIC_LIGHTS.find((light) => light === value) ?? "red";
}

export interface TrafficLightInput {
  story_type: string;
  claims: readonly ClassifiedClaim[];
  /** Phrases that tip or predict a winner. */
  tips: readonly string[];
  /** Injury, discipline, minors, legal or personal topics. */
  escalation_words: readonly string[];
  /** The LLM answered with something unusable (empty, wrong length or shape). */
  llm_error: string | null;
}

export interface TrafficLightDecision {
  traffic_light: TrafficLight;
  /** Why, for the editor (stored with the story). */
  reasons: string[];
}

export function decide_traffic_light(input: TrafficLightInput): TrafficLightDecision {
  const red: string[] = [];
  if (input.llm_error !== null) {
    red.push(`LLM error: ${input.llm_error}`);
  }
  for (const claim of input.claims.filter((candidate) => candidate.status === "wrong")) {
    red.push(`Wrong claim "${claim.claim}": ${claim.reason ?? "contradicts the fact sheet"}`);
  }
  for (const tip of input.tips) {
    red.push(`Tips or predicts a winner: "${tip}"`);
  }
  for (const word of input.escalation_words) {
    red.push(`Sensitive topic (injury, legal or personal): "${word}"`);
  }
  if (red.length > 0) {
    return { traffic_light: "red", reasons: red };
  }
  const yellow = input.claims
    .filter((claim) => claim.status === "not_found")
    .map((claim) => `Not in the fact sheet: "${claim.claim}"`);
  if (!AUTO_PUBLISH_STORY_TYPES.includes(input.story_type)) {
    yellow.push(`New story type "${input.story_type}": an editor approves it`);
  }
  if (yellow.length > 0) {
    return { traffic_light: "yellow", reasons: yellow };
  }
  return {
    traffic_light: "green",
    reasons: [`All ${String(input.claims.length)} claims verified against the fact sheet`],
  };
}
