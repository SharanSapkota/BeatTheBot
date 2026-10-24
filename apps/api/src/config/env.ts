import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { config as load_dotenv } from "dotenv";
import { parse_env, type Env } from "./env_schema";

export type { Env };

// pnpm runs scripts inside apps/api, but the shared .env lives in the repo root. Every non-empty
// .env from here upwards is read; a nearer file wins (e.g. apps/api/.env with a local key).
function find_env_files(start_directory: string): string[] {
  const files: string[] = [];
  let directory = start_directory;
  while (true) {
    const candidate = path.join(directory, ".env");
    if (existsSync(candidate) && statSync(candidate).size > 0) {
      files.push(candidate);
    }
    const parent_directory = path.dirname(directory);
    if (parent_directory === directory) {
      return files;
    }
    directory = parent_directory;
  }
}

function load_env(): Env {
  // dotenv never overrides a variable that is already set, so the nearest file is read first.
  for (const env_file of find_env_files(process.cwd())) {
    load_dotenv({ path: env_file, quiet: true });
  }

  try {
    return parse_env(process.env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${message}\n\nCheck your .env file against .env.example.`);
    process.exit(1);
  }
}

export const env = load_env();
