import { describe, expect, it } from "vitest";
import { ScriptedLlmClient } from "../../test_helpers/scripted_llm_client";
import { RateLimitedLlmClient } from "./rate_limited_llm_client";

const REQUEST = { system: "s", prompt: "p", max_tokens: 10 };

describe("RateLimitedLlmClient", () => {
  it("lets the first N calls through and waits a minute for the next one", async () => {
    let now = 0;
    const waits: number[] = [];
    const scripted = new ScriptedLlmClient(["ok"]);
    const client = new RateLimitedLlmClient(scripted, 2, {
      now: () => now,
      sleep: (ms) => {
        waits.push(ms);
        now += ms;
        return Promise.resolve();
      },
    });

    await client.complete(REQUEST);
    now += 1000;
    await client.complete(REQUEST);
    await client.complete(REQUEST);

    expect(scripted.requests).toHaveLength(3);
    // The third call waited until the first left the 60-second window.
    expect(waits).toEqual([59_000]);
  });
});
