import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { config as load_dotenv } from "dotenv";
import { parse_env, type Env } from "./env_schema";

export type { Env };

// pnpm runs scripts inside apps/api, but .env lives in the repo root, so search upwards.
function find_env_file(start_directory: string): string | undefined {
  let directory = start_directory;
  while (true) {
    const candidate = path.join(directory, ".env");
    // An empty .env (e.g. apps/api/.env) would hide the real one in the repo root.
    if (existsSync(candidate) && statSync(candidate).size > 0) {
      return candidate;
    }
    const parent_directory = path.dirname(directory);
    if (parent_directory === directory) {
      return undefined;
    }
    directory = parent_directory;
  }
}

function load_env(): Env {
  const env_file = find_env_file(process.cwd());
  if (env_file) {
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
