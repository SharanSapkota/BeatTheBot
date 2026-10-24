// docs/editorial_rules.md → Traffic light. AI stories are never green: a human always approves.

export type TrafficLight = "green" | "yellow" | "red";

const TRAFFIC_LIGHTS: readonly TrafficLight[] = ["green", "yellow", "red"];

/** A stored value; anything unknown is treated as red (full review). */
export function to_traffic_light(value: string): TrafficLight {
  return TRAFFIC_LIGHTS.find((light) => light === value) ?? "red";
}

export interface TrafficLightInput {
  /** The text passed check_claims (after at most 2 retries). */
  check_passed: boolean;
  /** Injury, discipline or minors words found in the text. */
  escalation_words: readonly string[];
}

/** 🔴 full review when the check failed or the text touches injuries, discipline or minors. */
export function decide_traffic_light({
  check_passed,
  escalation_words,
}: TrafficLightInput): TrafficLight {
  return check_passed && escalation_words.length === 0 ? "yellow" : "red";
}
