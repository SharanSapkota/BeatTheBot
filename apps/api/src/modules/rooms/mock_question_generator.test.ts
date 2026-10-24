import { ROOM_TOPICS } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { MOCK_BANKS, MockQuestionGenerator, parse_bank } from "./mock_question_generator";

// No politics or elections in room questions.
const POLITICS_WORDS = /\b(election|vote|party|parliament|president|minister|government|politic)/i;

describe("mock question banks", () => {
  it.each(ROOM_TOPICS)("%s has at least 40 questions, trivia and opinion mixed", (topic) => {
    const bank = MOCK_BANKS[topic];
    expect(bank.length).toBeGreaterThanOrEqual(40);
    expect(bank.some((question) => question.question_type === "trivia")).toBe(true);
    expect(bank.some((question) => question.question_type === "opinion")).toBe(true);
  });

  it.each(ROOM_TOPICS)("%s has unique prompts and options", (topic) => {
    const bank = MOCK_BANKS[topic];
    expect(new Set(bank.map((question) => question.prompt)).size).toBe(bank.length);
    for (const question of bank) {
      expect(new Set(question.options).size).toBe(question.options.length);
    }
  });

  it.each(ROOM_TOPICS)("%s has no politics or elections", (topic) => {
    for (const question of MOCK_BANKS[topic]) {
      expect(`${question.prompt} ${question.options.join(" ")}`).not.toMatch(POLITICS_WORDS);
    }
  });

  it("rejects a trivia answer that points outside the options", () => {
    expect(() =>
      parse_bank([{ type: "trivia", prompt: "Q?", options: ["A", "B"], correct: 2 }]),
    ).toThrow();
  });
});

describe("MockQuestionGenerator", () => {
  it("writes a question from the topic's bank that is not used yet", async () => {
    const generator = new MockQuestionGenerator();
    const used = MOCK_BANKS.hockey.slice(1).map((question) => question.prompt);
    const question = await generator.generate({ topic: "hockey", used_prompts: used, seed: "x:1" });
    expect(question.prompt).toBe(MOCK_BANKS.hockey[0]?.prompt);
    expect(question.source).toBe("mock");
  });
});
