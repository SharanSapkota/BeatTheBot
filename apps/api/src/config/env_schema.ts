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

export const env_schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: z.url(),
  CORS_ALLOWED_ORIGINS: comma_separated_list(z.url()),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  MAIL_FROM: z.string().min(1),
  ADMIN_EMAILS: comma_separated_list(z.email()),

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

export type Env = Readonly<
  Omit<z.infer<typeof env_schema>, "DEMO_REPLAY_ENABLED"> & { DEMO_REPLAY_ENABLED: boolean }
>;

export function parse_env(raw_env: NodeJS.ProcessEnv): Env {
  const result = env_schema.safeParse(raw_env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  const parsed = result.data;
  return Object.freeze({
    ...parsed,
    DEMO_REPLAY_ENABLED: parsed.DEMO_REPLAY_ENABLED ?? parsed.NODE_ENV !== "production",
  });
}
