import { env } from "../../config/env";
import { create_database } from "../../db/kysely";
import {
  create_liiga_client,
  liiga_source_from_args,
} from "../../integrations/liiga_client/create_liiga_client";
import { describe_sync_summary, SyncGamesJob } from "../sync_games";
import { KyselySyncGamesRepository } from "../sync_games_repository";

// Usage: tsx src/jobs/scripts/sync_games.ts [--fixtures]
async function main(): Promise<void> {
  const source = liiga_source_from_args(process.argv);
  const db = create_database(env.DATABASE_URL);
  try {
    const job = new SyncGamesJob(
      create_liiga_client(env, source),
      new KyselySyncGamesRepository(db),
      () => new Date(),
    );
    console.log(`Synced from ${source}. ${describe_sync_summary(await job.run())}`);
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
