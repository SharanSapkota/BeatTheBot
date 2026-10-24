import type { LlmClient } from "./llm_client";
import { MockLlmClient } from "./mock_llm_client";

/**
 * The LLM for story writing. Mocked for now (decided 2026-10-24); a real provider is added
 * here later, configured from LLM_API_KEY and LLM_MODEL in config/env.ts.
 */
export function create_llm_client(): LlmClient {
  return new MockLlmClient();
}
