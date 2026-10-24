import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { ScriptedLlmClient } from "../../test_helpers/scripted_llm_client";
import { LlmQuestionGenerator, create_question_generator } from "./llm_question_generator";
import { MockQuestionGenerator } from "./mock_question_generator";

const logger = pino({ level: "silent" });

describe("LlmQuestionGenerator", () => {
  it("falls back to the mock bank (the LLM path is not built yet)", async () => {
    const generator = new LlmQuestionGenerator(undefined, new MockQuestionGenerator(), logger);
    const question = await generator.generate({ topic: "football", used_prompts: [], seed: "r:0" });
    expect(question.source).toBe("mock");
  });

  it("falls back to the mock bank even with an LLM client", async () => {
    const llm = new ScriptedLlmClient(["{}"]);
    const generator = new LlmQuestionGenerator(llm, new MockQuestionGenerator(), logger);
    const question = await generator.generate({ topic: "hockey", used_prompts: [], seed: "r:1" });
    expect(question.source).toBe("mock");
    expect(question.options.length).toBeGreaterThanOrEqual(2);
  });

  it("is used only for ROOM_QUESTIONS_SOURCE=llm", () => {
    const mock = new MockQuestionGenerator();
    expect(create_question_generator("mock", undefined, logger, mock)).toBe(mock);
    expect(create_question_generator("llm", undefined, logger, mock)).toBeInstanceOf(
      LlmQuestionGenerator,
    );
  });
});
