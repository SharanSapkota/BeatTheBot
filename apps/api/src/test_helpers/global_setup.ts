import { ensure_test_database } from "../../scripts/ensure_test_database";
import { env } from "../config/env";
import { create_database } from "../db/kysely";
import { migrate_to_latest } from "../db/migrator";
import { test_database_url } from "./test_database";

function assert_is_test_database(test_database_url: string): void {
  const database_name = new URL(test_database_url).pathname.slice(1);
  if (test_database_url === env.DATABASE_URL || !database_name.endsWith("_test")) {
    throw new Error(
      `TEST_DATABASE_URL must point to a separate database ending in "_test" (got "${database_name}").`,
    );
  }
}

export default async function global_setup(): Promise<void> {
  const url = test_database_url();
  assert_is_test_database(url);
  await ensure_test_database(url);

  const db = create_database(url);
  try {
    await migrate_to_latest(db);
  } finally {
    await db.destroy();
  }
}
