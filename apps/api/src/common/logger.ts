import { pino, type Logger } from "pino";

export type { Logger };

interface LoggerOptions {
  level: string;
  pretty: boolean;
}

export function create_logger({ level, pretty }: LoggerOptions): Logger {
  return pino({
    level,
    transport: pretty ? { target: "pino-pretty", options: { colorize: true } } : undefined,
  });
}
