import type { Env } from "../../config/env";
import { FixtureLiigaClient } from "./fixture_liiga_client";
import { HttpLiigaClient } from "./http_liiga_client";
import type { LiigaClient } from "./liiga_client";

export type LiigaSource = "api" | "fixtures";

export function create_liiga_client(
  env: Pick<Env, "LIIGA_API_BASE_URL" | "LIIGA_API_KEY">,
  source: LiigaSource = "api",
): LiigaClient {
  if (source === "fixtures") {
    return new FixtureLiigaClient();
  }
  return new HttpLiigaClient({ base_url: env.LIIGA_API_BASE_URL, api_key: env.LIIGA_API_KEY });
}

/** Reads `--fixtures` from a script's command line. */
export function liiga_source_from_args(args: readonly string[]): LiigaSource {
  return args.includes("--fixtures") ? "fixtures" : "api";
}
