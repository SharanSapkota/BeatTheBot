import { sql, type QueryExecutorProvider } from "kysely";

/** Empties every app table (keeps Kysely's migration bookkeeping). */
export async function truncate_all_tables(db: QueryExecutorProvider): Promise<void> {
  const { rows } = await sql<{ table_name: string }>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'kysely_migration%'
  `.execute(db);
  if (rows.length === 0) {
    return;
  }
  const tables = sql.join(rows.map((row) => sql.table(row.table_name)));
  await sql`TRUNCATE ${tables} RESTART IDENTITY CASCADE`.execute(db);
}
