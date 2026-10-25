import { seed_demo_data } from "../db/seed/seed_demo_data";
import type { Database } from "../db/kysely";
import { FixtureLiigaClient } from "../integrations/liiga_client/fixture_liiga_client";
import { SyncGamesJob } from "../jobs/sync_games";
import { KyselySyncGamesRepository } from "../jobs/sync_games_repository";
import { insert_today_games } from "./insert_today_games";
import { reset_test_database } from "./test_database";
import { TEST_NOW } from "./create_test_app";

/**
 * Empties the test database, syncs the saved Liiga fixtures (offline), adds the test day's demo
 * hockey games (tests only) and the demo data for TEST_NOW (2026-10-24 15:00 Helsinki). That
 * day then has:
 * - live: demo KooKoo - Pelicans, 1-1
 * - upcoming: real Kärpät - KalPa at 17:00 (featured)
 * - final: demo Jukurit - JYP, 3-1
 */
export async function seed_fixture_database(db: Database, now: Date = TEST_NOW): Promise<void> {
  await reset_test_database(db);
  await new SyncGamesJob(
    new FixtureLiigaClient(),
    new KyselySyncGamesRepository(db),
    () => now,
  ).run();
  // The seed removes demo games, so the test day's games come after it.
  await seed_demo_data(db, { now, editor_email: "editor@test.local" });
  await insert_today_games(db, now);
}
