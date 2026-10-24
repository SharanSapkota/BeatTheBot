import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Kysely } from "kysely";
import { FileMigrationProvider, Migrator, type MigrationResultSet } from "kysely/migration";

const migration_folder = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

function create_migrator<T>(db: Kysely<T>): Migrator {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: migration_folder,
      // Import from this module, so tsx and Vitest can load the .ts migration files.
      import: (module_path: string) => import(module_path),
    }),
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
