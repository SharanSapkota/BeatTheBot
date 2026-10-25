import { env } from "../../config/env";
import {
  create_liiga_client,
  liiga_source_from_args,
  type LiigaSource,
} from "../../integrations/liiga_client/create_liiga_client";
import { describe_sync_summary, SyncGamesJob } from "../../jobs/sync_games";
import { KyselySyncGamesRepository } from "../../jobs/sync_games_repository";
import type { Database } from "../kysely";
import { create_database } from "../kysely";
import { seed_demo_and_score } from "../seed/seed_demo_and_score";

/** Real Liiga data first. If the API can't be reached, fall back to the saved fixtures. */
async function sync_liiga(db: Database, source: LiigaSource): Promise<void> {
  const run = (from: LiigaSource) =>
    new SyncGamesJob(
      create_liiga_client(env, from),
      new KyselySyncGamesRepository(db),
      () => new Date(),
    ).run();

  try {
    console.log(`Synced from ${source}. ${describe_sync_summary(await run(source))}`);
  } catch (error) {
    if (source === "fixtures") {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Liiga API sync failed (${reason}). Using saved fixtures instead.`);
    console.log(`Synced from fixtures. ${describe_sync_summary(await run("fixtures"))}`);
  }
}

export async function run_seed(source: LiigaSource): Promise<void> {
  const db = create_database(env.DATABASE_URL);
  try {
    await sync_liiga(db, source);
    console.log((await seed_demo_and_score(db, env.ADMIN_EMAILS)).join("\n"));
  } finally {
    await db.destroy();
  }
}

// Usage: tsx src/db/scripts/seed.ts [--fixtures]. Runs only when executed directly
// (reset.ts imports run_seed).
if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  run_seed(liiga_source_from_args(process.argv)).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
