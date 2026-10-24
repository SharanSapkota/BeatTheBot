import pg from "pg";

const DUPLICATE_DATABASE_ERROR_CODE = "42P04";
const safe_database_name_pattern = /^[a-z0-9_]+$/;

function get_database_name(database_url: string): string {
  const database_name = new URL(database_url).pathname.slice(1);
  if (!safe_database_name_pattern.test(database_name)) {
    throw new Error(`Unsafe test database name: "${database_name}"`);
  }
  return database_name;
}

function is_duplicate_database_error(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === DUPLICATE_DATABASE_ERROR_CODE;
}

/**
 * Creates the test database if it does not exist yet. Connects to the default
 * "postgres" database on the same server, because Docker only creates POSTGRES_DB
 * when the volume is first initialised.
 */
export async function ensure_test_database(test_database_url: string): Promise<void> {
  const database_name = get_database_name(test_database_url);
  const admin_url = new URL(test_database_url);
  admin_url.pathname = "/postgres";

  const client = new pg.Client({ connectionString: admin_url.toString() });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      database_name,
    ]);
    if (existing.rowCount === 0) {
      // Identifiers cannot be query parameters; the name is validated above.
      await client.query(`CREATE DATABASE "${database_name}"`);
    }
  } catch (error) {
    // Another process created it at the same moment: that is fine.
    if (!is_duplicate_database_error(error)) {
      throw error;
    }
  } finally {
    await client.end();
  }
}
