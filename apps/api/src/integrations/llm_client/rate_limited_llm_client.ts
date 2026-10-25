import type { LlmClient, LlmRequest, LlmResponse } from "./llm_client";

const MINUTE_MS = 60 * 1000;

export interface RateLimitTiming {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const REAL_TIMING: RateLimitTiming = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * At most `max_per_minute` LLM calls in any 60 seconds (env LLM_MAX_CALLS_PER_MINUTE). A call
 * over the limit waits for a free slot; it runs in the background story job, so waiting is fine.
 */
export class RateLimitedLlmClient implements LlmClient {
  private readonly started: number[] = [];

  constructor(
    private readonly client: LlmClient,
    private readonly max_per_minute: number,
    private readonly timing: RateLimitTiming = REAL_TIMING,
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    await this.wait_for_slot();
    return this.client.complete(request);
  }

  private async wait_for_slot(): Promise<void> {
    for (;;) {
      const now = this.timing.now();
      while (this.started.length > 0 && now - (this.started[0] ?? 0) >= MINUTE_MS) {
        this.started.shift();
      }
      if (this.started.length < this.max_per_minute) {
        this.started.push(now);
        return;
      }
      await this.timing.sleep((this.started[0] ?? now) + MINUTE_MS - now);
    }
  }
}
