import type { Kysely } from "kysely";
import { Migrator, type MigrationResultSet } from "kysely/migration";
import { migrations } from "./migrations";

function create_migrator<T>(db: Kysely<T>): Migrator {
  return new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });
}

function throw_on_error({ error, results }: MigrationResultSet): string[] {
  if (error) {
    const failed = results?.find((result) => result.status === "Error");
    throw new Error(`Migration ${failed?.migrationName ?? "(unknown)"} failed`, { cause: error });
  }
  return (results ?? []).map((result) => `${result.direction} ${result.migrationName}`);
}

// Returns the applied steps, e.g. ["Up 0001_sports_data"].
export async function migrate_to_latest<T>(db: Kysely<T>): Promise<string[]> {
  return throw_on_error(await create_migrator(db).migrateToLatest());
}

export async function migrate_down_one<T>(db: Kysely<T>): Promise<string[]> {
  return throw_on_error(await create_migrator(db).migrateDown());
}
