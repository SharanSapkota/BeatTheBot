import { pino, type Logger } from "pino";

export type { Logger };

interface LoggerOptions {
  level: string;
  pretty: boolean;
}

/** Request headers that carry secrets (session tokens, API keys). Never written to the logs. */
export const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  'res.headers["set-cookie"]',
];

/** JSON lines in production (pretty only in development), with secrets redacted. */
export function create_logger({ level, pretty }: LoggerOptions): Logger {
  return pino({
    level,
    redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
    transport: pretty ? { target: "pino-pretty", options: { colorize: true } } : undefined,
  });
}
