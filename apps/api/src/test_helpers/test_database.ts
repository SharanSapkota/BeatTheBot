import { env } from "../config/env";
import { create_database, type Database } from "../db/kysely";
import { truncate_all_tables } from "../db/truncate_all_tables";

export function test_database_url(): string {
  if (!env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is not set. Check your .env file against .env.example.");
  }
  return env.TEST_DATABASE_URL;
}

/** A connection to the test database. Call `destroy()` in afterAll. */
export function create_test_database(): Database {
  return create_database(test_database_url());
}

/** Empties every table, so each integration test starts from a clean database. */
export async function reset_test_database(db: Database): Promise<void> {
  await truncate_all_tables(db);
}
