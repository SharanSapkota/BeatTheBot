import { check_claims, strip_fact_ids } from "@voita_kone/fact_checker";
import { describe, expect, it } from "vitest";
import { MockLlmClient } from "../../integrations/llm_client/mock_llm_client";
import { build_headline, possessive } from "./story_headline";
import { SYSTEM_PROMPT, build_story_prompt } from "./story_prompt";
import { STORY_NAMES, STORY_SHEET } from "./test_story_sheet";
import { decide_traffic_light, to_traffic_light } from "./traffic_light";

describe("build_headline", () => {
  it("uses the biggest odds change, rounded like the story", () => {
    expect(build_headline(STORY_SHEET)).toBe("Kärpät's relegation risk drops to 27%");
  });

  it("writes the English possessive of names ending in s without another s", () => {
    expect(possessive("Kärpät")).toBe("Kärpät's");
    expect(possessive("Pelicans")).toBe("Pelicans'");
    expect(possessive("Ilves")).toBe("Ilves'");
  });

  it("falls back to the score when no odds changed", () => {
    const no_odds = {
      ...STORY_SHEET,
      facts: STORY_SHEET.facts.filter((fact) => fact.type !== "season_odds"),
    };
    expect(build_headline(no_odds)).toBe("Kärpät 3–1 Ilves");
  });

  it("passes the fact checker", () => {
    expect(check_claims(build_headline(STORY_SHEET), STORY_SHEET, STORY_NAMES).passed).toBe(true);
  });
});

describe("build_story_prompt", () => {
  it("embeds the fact sheet and, on a retry, the claims to fix", () => {
    const prompt = build_story_prompt(STORY_SHEET, [
      { claim: "4–1", type: "score", reason: "no matching score" },
    ]);

    expect(prompt).toContain(JSON.stringify(STORY_SHEET));
    expect(prompt).toContain('- "4–1": no matching score');
    expect(SYSTEM_PROMPT).toContain("Use only facts from the fact sheet");
  });
});

describe("decide_traffic_light", () => {
  it("is yellow when the check passed and nothing escalates, else red", () => {
    expect(decide_traffic_light({ check_passed: true, escalation_words: [] })).toBe("yellow");
    expect(decide_traffic_light({ check_passed: false, escalation_words: [] })).toBe("red");
    expect(decide_traffic_light({ check_passed: true, escalation_words: ["injur"] })).toBe("red");
  });

  it("reads stored values, unknown ones as red", () => {
    expect(to_traffic_light("yellow")).toBe("yellow");
    expect(to_traffic_light("purple")).toBe("red");
  });
});

describe("MockLlmClient", () => {
  it("writes a cited story from the fact sheet that passes the checker", async () => {
    const response = await new MockLlmClient().complete({
      system: SYSTEM_PROMPT,
      prompt: build_story_prompt(STORY_SHEET, []),
      temperature: 0.2,
      max_tokens: 400,
    });

    expect(response.model_name).toBe("mock_llm_v1");
    expect(response.text).toContain("[f1]");
    const body = strip_fact_ids(response.text);
    expect(body).toContain("Kärpät beat Ilves 3–1 at home.");
    expect(body).toContain("from 34% to 27%");
    expect(check_claims(body, STORY_SHEET, STORY_NAMES).failed_claims).toEqual([]);
  });

  it("fails loudly without a fact sheet in the prompt", async () => {
    await expect(
      new MockLlmClient().complete({ system: "", prompt: "hi", temperature: 0, max_tokens: 1 }),
    ).rejects.toThrow("no fact sheet");
  });
});
