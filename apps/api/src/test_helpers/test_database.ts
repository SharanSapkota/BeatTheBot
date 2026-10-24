import { env } from "../config/env";
import { create_database, type Database } from "../db/kysely";
import { truncate_all_tables } from "../db/truncate_all_tables";

/** A connection to the test database. Call `destroy()` in afterAll. */
export function create_test_database(): Database {
  return create_database(env.TEST_DATABASE_URL);
}

/** Empties every table, so each integration test starts from a clean database. */
export async function reset_test_database(db: Database): Promise<void> {
  await truncate_all_tables(db);
}
