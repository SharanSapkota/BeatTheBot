import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "./database_types";

export type Database = Kysely<DB>;

export interface DatabaseOptions {
  /** Connections in the pool (env DATABASE_POOL_SIZE). Neon's pooler likes small pools. */
  max_connections?: number;
  /** Called when an idle connection breaks (e.g. Neon suspends the compute). */
  on_idle_error?: (error: Error) => void;
}

const DEFAULT_MAX_CONNECTIONS = 5;
const IDLE_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 10_000;
/** sslmode values that ask for an encrypted connection. */
const SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

/**
 * Pool settings for a connection string. With sslmode=require (Neon) the connection uses TLS
 * with a verified certificate. sslmode is taken out of the URL, because pg would otherwise
 * override the `ssl` option with it (and print a warning).
 */
export function build_pool_config(
  connection_string: string,
  max_connections = DEFAULT_MAX_CONNECTIONS,
): pg.PoolConfig {
  const url = new URL(connection_string);
  const ssl_mode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    ssl: ssl_mode !== null && SSL_MODES.has(ssl_mode) ? { rejectUnauthorized: true } : undefined,
    max: max_connections,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  };
}

// Each call creates its own connection pool. The API builds one shared instance in
// container.ts from env.DATABASE_URL and destroys it on shutdown; tests and scripts
// create their own and destroy them when done.
export function create_database(
  connection_string: string,
  options: DatabaseOptions = {},
): Database {
  const pool = new pg.Pool(build_pool_config(connection_string, options.max_connections));
  // Without a listener a broken idle connection would crash the process.
  pool.on("error", (error) => {
    if (options.on_idle_error) {
      options.on_idle_error(error);
    } else {
      console.error(`Database connection error: ${error.message}`);
    }
  });
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}
