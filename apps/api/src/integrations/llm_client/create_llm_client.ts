import type { Env } from "../../config/env";
import { AnthropicLlmClient, DEFAULT_LLM_MODEL } from "./anthropic_llm_client";
import type { LlmClient } from "./llm_client";
import { RateLimitedLlmClient } from "./rate_limited_llm_client";

/**
 * Claude when LLM_API_KEY is set (at most LLM_MAX_CALLS_PER_MINUTE calls a minute); otherwise
 * none, and stories use the template text.
 */
export function create_llm_client(
  env: Pick<Env, "LLM_API_KEY" | "LLM_MODEL" | "LLM_MAX_CALLS_PER_MINUTE">,
): LlmClient | undefined {
  if (env.LLM_API_KEY === "") {
    return undefined;
  }
  return new RateLimitedLlmClient(
    new AnthropicLlmClient(env.LLM_API_KEY, env.LLM_MODEL || DEFAULT_LLM_MODEL),
    env.LLM_MAX_CALLS_PER_MINUTE,
  );
}
