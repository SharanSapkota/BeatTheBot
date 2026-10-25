import { z } from "zod";

function comma_separated_list<T extends z.ZodType<unknown, string>>(item_schema: T) {
  return z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    )
    .pipe(z.array(item_schema));
}

const port_schema = z.coerce.number().int().min(1).max(65535);

/** An optional variable that is set but empty ("FOO=" in .env or a dashboard) counts as not set. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

/** "https://app.example.com/" → "https://app.example.com" (CORS compares exact origins). */
const origin_schema = z.url().transform((value) => new URL(value).origin);

export const env_schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Render and Railway set PORT; it wins over API_PORT (see parse_env).
  PORT: optional(port_schema),
  API_PORT: port_schema.default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Used by the app. On Neon: the pooled URL (host with "-pooler").
  DATABASE_URL: z.url(),
  // Used by migrations. On Neon: the direct URL. Falls back to DATABASE_URL.
  DATABASE_DIRECT_URL: optional(z.url()),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),
  // Only the tests need it (see test_helpers/test_database.ts).
  TEST_DATABASE_URL: optional(z.url()),
  CORS_ALLOWED_ORIGINS: comma_separated_list(origin_schema),
  // Proxy hops in front of the API (Render / Railway: 1), so req.ip is the real client IP.
  // Defaults to 1 in production and 0 elsewhere (see parse_env).
  TRUST_PROXY_HOPS: optional(z.coerce.number().int().min(0).max(5)),
  // Folder for uploaded highlight videos. Not set or not writable in production → video URLs only.
  UPLOAD_DIR: optional(z.string()),

  // Email is a later step, so these have local Mailpit defaults.
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: port_schema.default(1025),
  MAIL_FROM: z.string().min(1).default("Voita Kaleva <no-reply@voitakone.local>"),
  ADMIN_EMAILS: comma_separated_list(z.email()).default([]),

  LIIGA_API_BASE_URL: z.url(),
  // Must be present. It may be empty while the API answers without a key (see docs/liiga_api).
  LIIGA_API_KEY: z.string(),
  // Games of this team are flagged `featured` and listed first. Default: Kärpät.
  FEATURED_TEAM_EXTERNAL_ID: z.string().min(1).default("495643563:kärpät"),
  LIVE_SYNC_ENABLED: z.stringbool().default(true),
  LIVE_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(30),
  // Defaults to true everywhere except production (see parse_env).
  DEMO_REPLAY_ENABLED: z.stringbool().optional(),

  // Not needed until a later step, so an empty string is allowed for now.
  LLM_API_KEY: z.string().default(""),
  LLM_MODEL: z.string().default(""),
  // AI previews and summaries: at most this many LLM calls a minute.
  LLM_MAX_CALLS_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  // Where room questions come from. "llm" is not built yet and falls back to the mock bank.
  ROOM_QUESTIONS_SOURCE: z.enum(["mock", "llm"]).default("mock"),
});
// VITE_* variables in .env belong to the web app and are not read here.

type ParsedEnv = z.infer<typeof env_schema>;

export type Env = Readonly<
  Omit<ParsedEnv, "DEMO_REPLAY_ENABLED" | "TRUST_PROXY_HOPS" | "DATABASE_DIRECT_URL"> & {
    DEMO_REPLAY_ENABLED: boolean;
    TRUST_PROXY_HOPS: number;
    DATABASE_DIRECT_URL: string;
    /** The port the API listens on: PORT if set, else API_PORT. */
    LISTEN_PORT: number;
  }
>;

export function parse_env(raw_env: NodeJS.ProcessEnv): Env {
  const result = env_schema.safeParse(raw_env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  const parsed = result.data;
  const is_production = parsed.NODE_ENV === "production";
  if (is_production && parsed.CORS_ALLOWED_ORIGINS.length === 0) {
    throw new Error(
      "Invalid environment variables:\nCORS_ALLOWED_ORIGINS must list the web app origin in production.",
    );
  }
  return Object.freeze({
    ...parsed,
    DEMO_REPLAY_ENABLED: parsed.DEMO_REPLAY_ENABLED ?? !is_production,
    TRUST_PROXY_HOPS: parsed.TRUST_PROXY_HOPS ?? (is_production ? 1 : 0),
    DATABASE_DIRECT_URL: parsed.DATABASE_DIRECT_URL ?? parsed.DATABASE_URL,
    LISTEN_PORT: parsed.PORT ?? parsed.API_PORT,
  });
}
