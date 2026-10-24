import { sql, type CreateTableBuilder, type Kysely, type RawBuilder } from "kysely";

// Shared building blocks for migrations. Kept outside migrations/ because
// FileMigrationProvider treats every file in that folder as a migration.

export const LANGUAGES = ["fi", "sv", "en"] as const;

export function with_id<T extends string, C extends string>(
  table: CreateTableBuilder<T, C>,
): CreateTableBuilder<T, C | "id"> {
  return table.addColumn("id", "uuid", (column) =>
    column.primaryKey().defaultTo(sql`gen_random_uuid()`),
  );
}

export function with_timestamps<T extends string, C extends string>(
  table: CreateTableBuilder<T, C>,
): CreateTableBuilder<T, C | "created_at" | "updated_at"> {
  return table
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`));
}

export const DATA_SOURCES = ["liiga_api", "demo"] as const;

/** Where a sports-data row came from. Demo rows only fill gaps in the real Liiga data. */
export function with_data_source<T extends string, C extends string>(
  table: CreateTableBuilder<T, C>,
): CreateTableBuilder<T, C | "data_source"> {
  return table.addColumn("data_source", "text", (column) =>
    column.notNull().defaultTo("liiga_api").check(is_one_of("data_source", DATA_SOURCES)),
  );
}

// Builds `column IN ('a', 'b')` for a CHECK constraint.
export function is_one_of(column_name: string, values: readonly string[]): RawBuilder<unknown> {
  const literal_values = values.map((value) => sql.lit(value));
  return sql`${sql.ref(column_name)} IN (${sql.join(literal_values)})`;
}

export async function add_updated_at_trigger(db: Kysely<unknown>, table_name: string) {
  await sql`
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON ${sql.table(table_name)}
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);
}
