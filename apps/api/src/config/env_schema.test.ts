import { describe, expect, it } from "vitest";
import { parse_env } from "./env_schema";

const valid_raw_env = {
  API_PORT: "3000",
  DATABASE_URL: "postgres://voita:voita@localhost:5432/voita_kone",
  TEST_DATABASE_URL: "postgres://voita:voita@localhost:5432/voita_kone_test",
  CORS_ALLOWED_ORIGINS: "http://localhost:5173, http://localhost:5174",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  MAIL_FROM: "Voita kone <no-reply@voitakone.local>",
  ADMIN_EMAILS: "",
  LIIGA_API_BASE_URL: "https://prod.liiga-backend.liiga.fi/stats",
  LIIGA_API_KEY: "",
};

describe("parse_env", () => {
  it("parses valid variables and applies defaults", () => {
    const env = parse_env(valid_raw_env);

    expect(env.API_PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:5173", "http://localhost:5174"]);
    expect(env.ADMIN_EMAILS).toEqual([]);
    expect(env.LLM_API_KEY).toBe("");
    expect(env.FEATURED_TEAM_EXTERNAL_ID).toBe("495643563:kärpät");
    expect(env.LIVE_SYNC_ENABLED).toBe(true);
    expect(env.LIVE_SYNC_INTERVAL_SECONDS).toBe(30);
    expect(env.DEMO_REPLAY_ENABLED).toBe(true);
    expect(Object.isFrozen(env)).toBe(true);
  });

  it("turns demo replay off by default in production, unless set", () => {
    const production = { ...valid_raw_env, NODE_ENV: "production" };

    expect(parse_env(production).DEMO_REPLAY_ENABLED).toBe(false);
    expect(parse_env({ ...production, DEMO_REPLAY_ENABLED: "true" }).DEMO_REPLAY_ENABLED).toBe(
      true,
    );
    expect(parse_env({ ...valid_raw_env, LIVE_SYNC_ENABLED: "false" }).LIVE_SYNC_ENABLED).toBe(
      false,
    );
  });

  it("throws a clear error when a variable is invalid", () => {
    expect(() => parse_env({ ...valid_raw_env, DATABASE_URL: "not a url" })).toThrow(
      /DATABASE_URL/,
    );
  });
});
