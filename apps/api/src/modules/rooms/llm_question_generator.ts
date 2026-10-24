import type { Logger } from "../../common/logger";
import type { LlmClient } from "../../integrations/llm_client/llm_client";
import type { GeneratedQuestion, QuestionGenerator, QuestionRequest } from "./question_generator";

/**
 * ROOM_QUESTIONS_SOURCE=llm. Not built yet: always uses the fallback (the mock bank).
 * TODO(rooms LLM): ask the LLM for a question on the topic (no politics or elections, no
 * repeats of `used_prompts`), validate the JSON, run trivia facts through the fact checker,
 * and fall back to the mock bank on any failure. Return `source: "llm"` only for LLM output.
 */
export class LlmQuestionGenerator implements QuestionGenerator {
  constructor(
    /** Undefined without LLM_API_KEY: then always the fallback. */
    private readonly llm_client: LlmClient | undefined,
    private readonly fallback: QuestionGenerator,
    private readonly logger: Logger,
  ) {}

  async generate(request: QuestionRequest): Promise<GeneratedQuestion> {
    try {
      return await this.generate_with_llm(request);
    } catch (error) {
      this.logger.warn(
        { err: error, topic: request.topic },
        "LLM room question failed, using the mock bank",
      );
      return this.fallback.generate(request);
    }
  }

  private generate_with_llm(_request: QuestionRequest): Promise<GeneratedQuestion> {
    if (this.llm_client === undefined) {
      return Promise.reject(new Error("LLM_API_KEY is not set"));
    }
    return Promise.reject(new Error("LLM room questions are not built yet"));
  }
}

/** The generator for ROOM_QUESTIONS_SOURCE (default mock). */
export function create_question_generator(
  source: "mock" | "llm",
  llm_client: LlmClient | undefined,
  logger: Logger,
  mock: QuestionGenerator,
): QuestionGenerator {
  return source === "llm" ? new LlmQuestionGenerator(llm_client, mock, logger) : mock;
}
