import {
  LlmUnavailableError,
  type LlmClient,
  type LlmRequest,
  type LlmResponse,
} from "../integrations/llm_client/llm_client";

/**
 * A fake LLM for tests: answers with the scripted texts in order (the last one repeats).
 * `"unavailable"` throws like a provider that is down.
 */
export class ScriptedLlmClient implements LlmClient {
  readonly requests: LlmRequest[] = [];

  constructor(private readonly answers: readonly (string | "unavailable")[]) {}

  complete(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(request);
    const answer = this.answers[Math.min(this.requests.length - 1, this.answers.length - 1)];
    if (answer === undefined || answer === "unavailable") {
      return Promise.reject(new LlmUnavailableError("scripted outage"));
    }
    return Promise.resolve({ text: answer, model_name: "scripted_llm" });
  }
}
