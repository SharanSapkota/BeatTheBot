import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "./database_types";

export type Database = Kysely<DB>;

// Each call creates its own connection pool. The API builds one shared instance in
// container.ts from env.DATABASE_URL and destroys it on shutdown; tests and scripts
// create their own and destroy them when done.
export function create_database(connection_string: string): Database {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: connection_string }),
    }),
  });
}
