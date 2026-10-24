import { sql, type Kysely } from "kysely";
import {
  LANGUAGES,
  add_updated_at_trigger,
  is_one_of,
  with_id,
  with_timestamps,
} from "../migration_helpers";

const TABLES = ["users", "auth_identities", "sessions"];

const AUTH_PROVIDERS = ["device", "email", "kaleva"] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  // The person. Login data lives in auth_identities, so accounts can be linked later.
  await db.schema
    .createTable("users")
    .$call(with_id)
    .addColumn("display_name", "text", (column) => column.notNull())
    .addColumn("role", "text", (column) =>
      column
        .notNull()
        .defaultTo("player")
        .check(is_one_of("role", ["player", "editor", "admin"])),
    )
    // Contact only, not used to sign in. Postgres allows many NULLs in a unique column.
    .addColumn("email", "text", (column) => column.unique().check(sql`email = lower(email)`))
    .addColumn("preferred_language", "text", (column) =>
      column.notNull().defaultTo("fi").check(is_one_of("preferred_language", LANGUAGES)),
    )
    .addColumn("is_subscriber", "boolean", (column) => column.notNull().defaultTo(false))
    .addColumn("deleted_at", "timestamptz")
    .$call(with_timestamps)
    .execute();

  // How a user signs in. One user can have many identities (device, email, Kaleva).
  await db.schema
    .createTable("auth_identities")
    .$call(with_id)
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("provider", "text", (column) =>
      column.notNull().check(is_one_of("provider", AUTH_PROVIDERS)),
    )
    .addColumn("provider_subject", "text", (column) => column.notNull())
    .addColumn("last_used_at", "timestamptz")
    .$call(with_timestamps)
    .addUniqueConstraint("auth_identities_provider_provider_subject_unique", [
      "provider",
      "provider_subject",
    ])
    .execute();
  await db.schema
    .createIndex("auth_identities_user_id_index")
    .on("auth_identities")
    .column("user_id")
    .execute();

  await db.schema
    .createTable("sessions")
    .$call(with_id)
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    // The unique constraint also serves as the token_hash index.
    .addColumn("token_hash", "text", (column) => column.notNull().unique())
    .addColumn("expires_at", "timestamptz", (column) => column.notNull())
    .addColumn("last_used_at", "timestamptz")
    .addColumn("user_agent", "text")
    .addColumn("revoked_at", "timestamptz")
    .$call(with_timestamps)
    .execute();
  await db.schema.createIndex("sessions_user_id_index").on("sessions").column("user_id").execute();

  for (const table_name of TABLES) {
    await add_updated_at_trigger(db, table_name);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table_name of [...TABLES].reverse()) {
    await db.schema.dropTable(table_name).execute();
  }
}
