import { sql, type Kysely } from "kysely";
import { is_one_of, with_id } from "../migration_helpers";

// Fans vs fans (step 5): the AI is a guide. AI preview (before) and AI summary (after) stories,
// fact sheets per kind, re-scoring without "beat the AI", and an audit log for editor actions.
const STORY_TYPES = ["preview", "summary", "recap"];

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE stories DROP CONSTRAINT stories_story_type_check`.execute(db);
  await sql`UPDATE stories SET story_type = 'summary' WHERE story_type = 'what_it_means'`.execute(
    db,
  );
  await sql`DELETE FROM stories WHERE story_type = 'ai_pick_reasons'`.execute(db);
  await db.schema
    .alterTable("stories")
    .addCheckConstraint("stories_story_type_check", is_one_of("story_type", STORY_TYPES))
    .execute();
  await db.schema
    .alterTable("stories")
    // llm = written by the LLM; template = the automatic text when no LLM is available.
    .addColumn("source", "text", (column) =>
      column
        .notNull()
        .defaultTo("llm")
        .check(is_one_of("source", ["llm", "template"])),
    )
    .addColumn("corrected_at", "timestamptz")
    .addColumn("correction_note", "text")
    .execute();

  await db.schema
    .alterTable("fact_sheets")
    .addColumn("kind", "text", (column) =>
      column
        .notNull()
        .defaultTo("summary")
        .check(is_one_of("kind", ["preview", "summary"])),
    )
    .execute();

  // Version of the scoring rules a pick was scored with; lower versions are scored again.
  await db.schema
    .alterTable("user_predictions")
    .addColumn("scoring_version", "integer", (column) => column.notNull().defaultTo(1))
    .execute();

  await db.schema
    .createTable("audit_log")
    .$call(with_id)
    // Null = the system (e.g. an automatic publish).
    .addColumn("actor_user_id", "uuid", (column) =>
      column.references("users.id").onDelete("set null"),
    )
    .addColumn("action", "text", (column) => column.notNull())
    .addColumn("target_type", "text", (column) => column.notNull())
    .addColumn("target_id", "uuid")
    .addColumn("details", "jsonb", (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex("audit_log_target_index")
    .on("audit_log")
    .columns(["target_type", "target_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("audit_log").execute();
  await db.schema.alterTable("user_predictions").dropColumn("scoring_version").execute();
  await db.schema.alterTable("fact_sheets").dropColumn("kind").execute();
  await db.schema
    .alterTable("stories")
    .dropColumn("source")
    .dropColumn("corrected_at")
    .dropColumn("correction_note")
    .execute();
  await sql`ALTER TABLE stories DROP CONSTRAINT stories_story_type_check`.execute(db);
  await sql`DELETE FROM stories WHERE story_type = 'preview'`.execute(db);
  await sql`UPDATE stories SET story_type = 'what_it_means' WHERE story_type = 'summary'`.execute(
    db,
  );
  await db.schema
    .alterTable("stories")
    .addCheckConstraint(
      "stories_story_type_check",
      is_one_of("story_type", ["what_it_means", "ai_pick_reasons", "recap"]),
    )
    .execute();
}
