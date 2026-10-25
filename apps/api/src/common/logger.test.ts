import { Writable } from "node:stream";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { REDACTED_PATHS } from "./logger";

describe("logger redaction", () => {
  it("never writes the Authorization header or an API key", () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pino({ redact: { paths: REDACTED_PATHS, censor: "[redacted]" } }, stream);

    logger.info({
      req: { headers: { authorization: "Bearer secret-token", "x-api-key": "secret-key" } },
    });

    const output = lines.join("");
    expect(output).not.toContain("secret-token");
    expect(output).not.toContain("secret-key");
    expect(output).toContain("[redacted]");
  });
});
