import { sql, type Kysely } from "kysely";
import {
  LANGUAGES,
  add_updated_at_trigger,
  is_one_of,
  with_id,
  with_timestamps,
} from "../migration_helpers";

const TABLES = [
  "fact_sheets",
  "stories",
  "story_reviews",
  "highlights",
  "highlight_texts",
  "error_reports",
  "corrections",
];

const TARGET_TYPES = ["story", "highlight", "question"];

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("fact_sheets")
    .$call(with_id)
    .addColumn("game_id", "uuid", (column) =>
      column.notNull().references("games.id").onDelete("cascade"),
    )
    .addColumn("facts", "jsonb", (column) => column.notNull())
    .addColumn("built_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .$call(with_timestamps)
    .execute();
  await db.schema
    .createIndex("fact_sheets_game_id_index")
    .on("fact_sheets")
    .column("game_id")
    .execute();

  await db.schema
    .createTable("stories")
    .$call(with_id)
    .addColumn("game_id", "uuid", (column) =>
      column.notNull().references("games.id").onDelete("cascade"),
    )
    .addColumn("story_type", "text", (column) =>
      column
        .notNull()
        .check(is_one_of("story_type", ["what_it_means", "ai_pick_reasons", "recap"])),
    )
    .addColumn("language", "text", (column) =>
      column.notNull().check(is_one_of("language", LANGUAGES)),
    )
    .addColumn("body", "text", (column) => column.notNull())
    // No ON DELETE rule: a story must keep the fact sheet it was checked against.
    .addColumn("fact_sheet_id", "uuid", (column) => column.notNull().references("fact_sheets.id"))
    .addColumn("traffic_light", "text", (column) =>
      column.notNull().check(is_one_of("traffic_light", ["green", "yellow", "red"])),
    )
    .addColumn("status", "text", (column) =>
      column
        .notNull()
        .defaultTo("draft")
        .check(is_one_of("status", ["draft", "in_review", "published", "rejected", "corrected"])),
    )
    .addColumn("check_result", "jsonb")
    .addColumn("generation_attempts", "integer", (column) => column.notNull().defaultTo(0))
    .addColumn("prompt_version", "text")
    .addColumn("published_at", "timestamptz")
    .addColumn("label_text", "text")
    .$call(with_timestamps)
    .execute();
  await db.schema
    .createIndex("stories_status_traffic_light_index")
    .on("stories")
    .columns(["status", "traffic_light"])
    .execute();
  await db.schema.createIndex("stories_game_id_index").on("stories").column("game_id").execute();

  await db.schema
    .createTable("story_reviews")
    .$call(with_id)
    .addColumn("story_id", "uuid", (column) =>
      column.notNull().references("stories.id").onDelete("cascade"),
    )
    .addColumn("editor_user_id", "uuid", (column) =>
      column.references("users.id").onDelete("set null"),
    )
    .addColumn("decision", "text", (column) =>
      column.notNull().check(is_one_of("decision", ["approve", "edit", "reject"])),
    )
    .addColumn("edited_body", "text")
    .addColumn("notes", "text")
    .addColumn("reviewed_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .$call(with_timestamps)
    .execute();

  await db.schema
    .createTable("highlights")
    .$call(with_id)
    .addColumn("game_id", "uuid", (column) =>
      column.notNull().references("games.id").onDelete("cascade"),
    )
    .addColumn("game_event_id", "uuid", (column) =>
      column.references("game_events.id").onDelete("set null"),
    )
    .addColumn("video_url", "text", (column) => column.notNull())
    .addColumn("duration_seconds", "integer", (column) => column.check(sql`duration_seconds > 0`))
    .addColumn("clip_credit", "text")
    .addColumn("rights_confirmed_by", "uuid", (column) =>
      column.references("users.id").onDelete("set null"),
    )
    .addColumn("rights_confirmed_at", "timestamptz")
    .addColumn("timestamp_check_passed", "boolean", (column) => column.notNull().defaultTo(false))
    .addColumn("status", "text", (column) =>
      column
        .notNull()
        .defaultTo("draft")
        .check(is_one_of("status", ["draft", "published", "corrected", "removed"])),
    )
    .addColumn("published_by", "uuid", (column) =>
      column.references("users.id").onDelete("set null"),
    )
    .addColumn("published_at", "timestamptz")
    .$call(with_timestamps)
    .execute();
  await db.schema
    .createIndex("highlights_game_id_status_index")
    .on("highlights")
    .columns(["game_id", "status"])
    .execute();

  await db.schema
    .createTable("highlight_texts")
    .$call(with_id)
    .addColumn("highlight_id", "uuid", (column) =>
      column.notNull().references("highlights.id").onDelete("cascade"),
    )
    .addColumn("language", "text", (column) =>
      column.notNull().check(is_one_of("language", LANGUAGES)),
    )
    .addColumn("headline", "text", (column) => column.notNull())
    .addColumn("caption", "text")
    .addColumn("source", "text", (column) =>
      column.notNull().check(is_one_of("source", ["editor", "ai_translation"])),
    )
    .addColumn("check_result", "jsonb")
    .addColumn("approved_by", "uuid", (column) =>
      column.references("users.id").onDelete("set null"),
    )
    .addColumn("approved_at", "timestamptz")
    .$call(with_timestamps)
    .addUniqueConstraint("highlight_texts_highlight_id_language_unique", [
      "highlight_id",
      "language",
    ])
    .execute();

  // error_reports and corrections point at a story, highlight or question through
  // (target_type, target_id), so target_id has no foreign key.
  await db.schema
    .createTable("error_reports")
    .$call(with_id)
    .addColumn("target_type", "text", (column) =>
      column.notNull().check(is_one_of("target_type", TARGET_TYPES)),
    )
    .addColumn("target_id", "uuid", (column) => column.notNull())
    .addColumn("reported_by", "uuid", (column) =>
      column.references("users.id").onDelete("set null"),
    )
    .addColumn("description", "text", (column) => column.notNull())
    .addColumn("status", "text", (column) =>
      column
        .notNull()
        .defaultTo("open")
        .check(is_one_of("status", ["open", "fixed", "invalid"])),
    )
    .addColumn("fixed_at", "timestamptz")
    .$call(with_timestamps)
    .execute();
  await db.schema
    .createIndex("error_reports_target_index")
    .on("error_reports")
    .columns(["target_type", "target_id"])
    .execute();

  await db.schema
    .createTable("corrections")
    .$call(with_id)
    .addColumn("target_type", "text", (column) =>
      column.notNull().check(is_one_of("target_type", TARGET_TYPES)),
    )
    .addColumn("target_id", "uuid", (column) => column.notNull())
    .addColumn("what_was_wrong", "text", (column) => column.notNull())
    .addColumn("corrected_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("corrected_by", "uuid", (column) =>
      column.references("users.id").onDelete("set null"),
    )
    .$call(with_timestamps)
    .execute();
  await db.schema
    .createIndex("corrections_target_index")
    .on("corrections")
    .columns(["target_type", "target_id"])
    .execute();

  for (const table_name of TABLES) {
    await add_updated_at_trigger(db, table_name);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table_name of [...TABLES].reverse()) {
    await db.schema.dropTable(table_name).execute();
  }
}
