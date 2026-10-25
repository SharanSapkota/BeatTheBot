import { describe, expect, it } from "vitest";
import { build_pool_config } from "./kysely";

describe("build_pool_config", () => {
  it("uses a verified TLS connection when the URL has sslmode=require", () => {
    const config = build_pool_config(
      "postgresql://user:secret@ep-x-pooler.eu-central-1.aws.neon.tech/voita?sslmode=require&channel_binding=require",
      3,
    );

    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.connectionString).toBe(
      "postgresql://user:secret@ep-x-pooler.eu-central-1.aws.neon.tech/voita?channel_binding=require",
    );
    expect(config.max).toBe(3);
  });

  it("uses no TLS for a local URL and a pool of 5 by default", () => {
    const config = build_pool_config("postgres://voita:voita@localhost:5432/voita_kone");

    expect(config.ssl).toBeUndefined();
    expect(config.max).toBe(5);
  });

  it("uses no TLS when sslmode=disable", () => {
    expect(build_pool_config("postgres://localhost/db?sslmode=disable").ssl).toBeUndefined();
  });
});
