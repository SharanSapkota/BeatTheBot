import type { ClassifiedClaim } from "@voita_kone/fact_checker";
import { describe, expect, it } from "vitest";
import { decide_traffic_light } from "./traffic_light";

function claim(status: ClassifiedClaim["status"]): ClassifiedClaim {
  return {
    claim: "3–1",
    type: "score",
    status,
    fact_ids: [],
    reason: status === "verified" ? null : "no matching score",
  };
}

const BASE = {
  story_type: "summary",
  claims: [claim("verified")],
  tips: [],
  escalation_words: [],
  betting_words: [],
  llm_error: null,
};

describe("decide_traffic_light", () => {
  it.each([
    ["all verified", BASE, "green"],
    ["a not-found claim", { ...BASE, claims: [claim("verified"), claim("not_found")] }, "yellow"],
    ["a new story type", { ...BASE, story_type: "recap" }, "yellow"],
    ["a wrong claim", { ...BASE, claims: [claim("wrong"), claim("not_found")] }, "red"],
    ["a tip", { ...BASE, tips: ["will win"] }, "red"],
    ["a sensitive topic", { ...BASE, escalation_words: ["injur"] }, "red"],
    ["betting language", { ...BASE, betting_words: ["bookmaker"] }, "red"],
    ["an LLM error", { ...BASE, llm_error: "empty answer" }, "red"],
  ] as const)("%s → %s", (_label, input, expected) => {
    expect(decide_traffic_light(input).traffic_light).toBe(expected);
  });

  it("stores the reasons for the editor", () => {
    expect(decide_traffic_light({ ...BASE, tips: ["favourite"] }).reasons).toEqual([
      'Tips or predicts a winner: "favourite"',
    ]);
  });
});
