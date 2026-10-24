import type { Env } from "../../config/env";
import { AnthropicLlmClient, DEFAULT_LLM_MODEL } from "./anthropic_llm_client";
import type { LlmClient } from "./llm_client";

/** Claude when LLM_API_KEY is set; otherwise none, and stories use the template text. */
export function create_llm_client(
  env: Pick<Env, "LLM_API_KEY" | "LLM_MODEL">,
): LlmClient | undefined {
  if (env.LLM_API_KEY === "") {
    return undefined;
  }
  return new AnthropicLlmClient(env.LLM_API_KEY, env.LLM_MODEL || DEFAULT_LLM_MODEL);
}
