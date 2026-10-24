// The LLM is a writer, not a calculator (docs/content_generation.md). Behind this interface
// so the provider can be swapped and tests can script the answers.

export interface LlmRequest {
  system: string;
  prompt: string;
  max_tokens: number;
}

export interface LlmResponse {
  text: string;
  /** Stored with each story (audit trail). */
  model_name: string;
}

export interface LlmClient {
  /** Throws `LlmUnavailableError` when the provider can't be reached (then a template is used). */
  complete(request: LlmRequest): Promise<LlmResponse>;
}

/** The provider is down, rate limited, refused or unreachable: write the template instead. */
export class LlmUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmUnavailableError";
  }
}

/** How prompts embed a fact sheet (JSON between these markers). */
export const FACT_SHEET_START = "<fact_sheet>";
export const FACT_SHEET_END = "</fact_sheet>";
