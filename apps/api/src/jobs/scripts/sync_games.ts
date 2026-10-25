import { env } from "../../config/env";
import { create_database } from "../../db/kysely";
import {
  create_liiga_client,
  liiga_source_from_args,
} from "../../integrations/liiga_client/create_liiga_client";
import { create_logger } from "../../common/logger";
import { run_liiga_sync } from "../run_liiga_sync";

// Usage: tsx src/jobs/scripts/sync_games.ts [--fixtures]
// After the sync the prediction model runs (skipped when its inputs did not change), then
// picks of newly finished games are scored.
async function main(): Promise<void> {
  const source = liiga_source_from_args(process.argv);
  const db = create_database(env.DATABASE_URL);
  try {
    const lines = await run_liiga_sync(
      db,
      create_liiga_client(env, source),
      create_logger({ level: "warn", pretty: false }),
      source,
    );
    console.log(lines.join("\n"));
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
