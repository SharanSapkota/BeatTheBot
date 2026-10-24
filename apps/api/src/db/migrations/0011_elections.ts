import { sql, type Kysely } from "kysely";
import { add_updated_at_trigger, is_one_of, with_id, with_timestamps } from "../migration_helpers";

// Elections (step 7): fans predict who gets the most votes. No AI data here.
// Also renames the role "player" to "user" (roles: user | editor | admin).
const ELECTION_TYPES = ["parliamentary", "municipal", "presidential", "county", "other"];
const AREA_TYPES = ["country", "electoral_district", "municipality"];
const ELECTION_STATUSES = ["draft", "published", "closed", "resulted"];
const ROLES = ["user", "editor", "admin"];
const OLD_ROLES = ["player", "editor", "admin"];

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users DROP CONSTRAINT users_role_check`.execute(db);
  await sql`UPDATE users SET role = 'user' WHERE role = 'player'`.execute(db);
  await sql`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'`.execute(db);
  await db.schema
    .alterTable("users")
    .addCheckConstraint("users_role_check", is_one_of("role", ROLES))
    .execute();

  await db.schema
    .createTable("elections")
    .$call(with_id)
    .addColumn("title", "text", (column) => column.notNull())
    .addColumn("election_type", "text", (column) =>
      column.notNull().check(is_one_of("election_type", ELECTION_TYPES)),
    )
    .addColumn("area_type", "text", (column) =>
      column.notNull().check(is_one_of("area_type", AREA_TYPES)),
    )
    .addColumn("area_name", "text", (column) => column.notNull())
    .addColumn("election_date", "date", (column) => column.notNull())
    .addColumn("poll_opens_at", "timestamptz", (column) => column.notNull())
    .addColumn("poll_closes_at", "timestamptz", (column) => column.notNull())
    .addColumn("status", "text", (column) =>
      column.notNull().defaultTo("draft").check(is_one_of("status", ELECTION_STATUSES)),
    )
    .addColumn("question_text", "text", (column) => column.notNull())
    .addColumn("is_demo", "boolean", (column) => column.notNull().defaultTo(false))
    .addColumn("created_by", "uuid", (column) => column.references("users.id").onDelete("set null"))
    .$call(with_timestamps)
    .addCheckConstraint("elections_poll_window_check", sql`poll_opens_at < poll_closes_at`)
    .execute();
  await db.schema
    .createIndex("elections_status_poll_closes_at_index")
    .on("elections")
    .columns(["status", "poll_closes_at"])
    .execute();

  await db.schema
    .createTable("election_candidates")
    .$call(with_id)
    .addColumn("election_id", "uuid", (column) =>
      column.notNull().references("elections.id").onDelete("cascade"),
    )
    .addColumn("full_name", "text", (column) => column.notNull())
    .addColumn("party_or_group", "text")
    .addColumn("candidate_number", "integer")
    // Written by the admin, never by the AI.
    .addColumn("short_bio", "text", (column) =>
      column
        .notNull()
        .defaultTo("")
        .check(sql`char_length(short_bio) <= 200`),
    )
    .addColumn("photo_url", "text", (column) => column.check(sql`photo_url LIKE 'https://%'`))
    .$call(with_timestamps)
    .execute();
  await db.schema
    .createIndex("election_candidates_election_id_index")
    .on("election_candidates")
    .column("election_id")
    .execute();

  // Only the prediction ("who will get the most votes"), never a personal vote intention.
  await db.schema
    .createTable("election_picks")
    .$call(with_id)
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("election_id", "uuid", (column) =>
      column.notNull().references("elections.id").onDelete("cascade"),
    )
    .addColumn("candidate_id", "uuid", (column) =>
      column.notNull().references("election_candidates.id"),
    )
    .addColumn("points_awarded", "integer")
    .addColumn("scored_at", "timestamptz")
    .$call(with_timestamps)
    .addUniqueConstraint("election_picks_user_id_election_id_unique", ["user_id", "election_id"])
    .execute();
  await db.schema
    .createIndex("election_picks_election_id_candidate_id_index")
    .on("election_picks")
    .columns(["election_id", "candidate_id"])
    .execute();

  await db.schema
    .createTable("election_results")
    .$call(with_id)
    .addColumn("election_id", "uuid", (column) =>
      column.notNull().unique().references("elections.id").onDelete("cascade"),
    )
    .addColumn("winner_candidate_id", "uuid", (column) =>
      column.notNull().references("election_candidates.id"),
    )
    .addColumn("vote_counts", "jsonb")
    .addColumn("entered_by", "uuid", (column) => column.references("users.id").onDelete("set null"))
    .addColumn("entered_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  for (const table_name of ["elections", "election_candidates", "election_picks"]) {
    await add_updated_at_trigger(db, table_name);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table_name of [
    "election_results",
    "election_picks",
    "election_candidates",
    "elections",
  ]) {
    await db.schema.dropTable(table_name).execute();
  }
  await sql`ALTER TABLE users DROP CONSTRAINT users_role_check`.execute(db);
  await sql`UPDATE users SET role = 'player' WHERE role = 'user'`.execute(db);
  await sql`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'player'`.execute(db);
  await db.schema
    .alterTable("users")
    .addCheckConstraint("users_role_check", is_one_of("role", OLD_ROLES))
    .execute();
}
