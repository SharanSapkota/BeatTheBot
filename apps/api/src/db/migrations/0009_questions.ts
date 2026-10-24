import { sql, type Kysely } from "kysely";

// Step 6: live picks, result quiz and player vote. Questions are created when first needed,
// so `question_key` (e.g. "next_goal:2", "result_quiz:1") makes that safe to repeat.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("questions")
    .addColumn("question_key", "text", (column) => column.notNull())
    // next_goal: goals already scored when it opened. period_goal: the period.
    .addColumn("target", "integer", (column) => column.check(sql`target >= 0`))
    // Quiz feedback per language: { "en": { "right": "...", "wrong": "..." } }.
    .addColumn("explanation", "jsonb")
    .execute();
  await db.schema
    .alterTable("questions")
    .addUniqueConstraint("questions_game_id_question_key_unique", ["game_id", "question_key"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("questions")
    .dropConstraint("questions_game_id_question_key_unique")
    .execute();
  await db.schema
    .alterTable("questions")
    .dropColumn("question_key")
    .dropColumn("target")
    .dropColumn("explanation")
    .execute();
}
