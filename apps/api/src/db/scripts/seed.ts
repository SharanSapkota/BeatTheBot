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
import { FALLBACK_EDITOR_EMAIL } from "../seed/demo_users";
import { seed_demo_data, type SeedSummary } from "../seed/seed_demo_data";

function print_seed_summary(summary: SeedSummary): void {
  console.log(
    `Demo fill-ins: ${String(summary.demo_game_count)} games, ${String(summary.demo_event_count)} events, ` +
      `${String(summary.user_count)} users, ${String(summary.prediction_count)} picks.`,
  );
  if (summary.unfilled_states.length > 0) {
    console.warn(
      `No game today for: ${summary.unfilled_states.join(", ")} (not enough free teams).`,
    );
  }
}

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
  const editor_email = env.ADMIN_EMAILS[0] ?? FALLBACK_EDITOR_EMAIL;
  if (!env.ADMIN_EMAILS[0]) {
    console.warn(`ADMIN_EMAILS is empty, so the demo editor is ${FALLBACK_EDITOR_EMAIL}.`);
  }

  const db = create_database(env.DATABASE_URL);
  try {
    await sync_liiga(db, source);
    print_seed_summary(await seed_demo_data(db, { now: new Date(), editor_email }));
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
