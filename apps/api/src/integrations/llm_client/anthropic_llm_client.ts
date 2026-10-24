import Anthropic from "@anthropic-ai/sdk";
import {
  LlmUnavailableError,
  type LlmClient,
  type LlmRequest,
  type LlmResponse,
} from "./llm_client";

/** Default model when LLM_MODEL is empty. */
export const DEFAULT_LLM_MODEL = "claude-opus-5-5";
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Claude through the Messages API. Short texts, so low effort. A refusal or any API error
 * counts as "unavailable": the story then falls back to the template from the same facts.
 */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;

  constructor(
    api_key: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey: api_key, timeout: REQUEST_TIMEOUT_MS });
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: request.max_tokens,
        system: request.system,
        output_config: { effort: "low" },
        // On a policy decline, the API retries on a fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content: request.prompt }],
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new LlmUnavailableError(`LLM API error ${String(error.status)}`, { cause: error });
      }
      throw new LlmUnavailableError("LLM request failed", { cause: error });
    }
    if (response.stop_reason === "refusal") {
      throw new LlmUnavailableError("The LLM declined the request");
    }
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    return { text, model_name: response.model };
  }
}
