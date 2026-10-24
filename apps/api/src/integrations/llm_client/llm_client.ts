// The LLM is a writer, not a calculator (docs/content_generation.md). Behind this interface
// so the provider can be swapped and tests can script the answers.

export interface LlmRequest {
  system: string;
  prompt: string;
  /** Low (≈0.2) for repeatable output. */
  temperature: number;
  max_tokens: number;
}

export interface LlmResponse {
  text: string;
  /** Stored with each story (audit trail). */
  model_name: string;
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

/** How prompts embed a fact sheet (JSON between these markers). */
export const FACT_SHEET_START = "<fact_sheet>";
export const FACT_SHEET_END = "</fact_sheet>";
