import type { Kysely } from "kysely";

// Step 10: a hash of the facts and the prompt version. When a game's facts have not changed,
// the story job does not call the LLM again.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("fact_sheets").addColumn("input_hash", "text").execute();
  await db.schema
    .createIndex("fact_sheets_game_id_kind_index")
    .on("fact_sheets")
    .columns(["game_id", "kind"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("fact_sheets_game_id_kind_index").execute();
  await db.schema.alterTable("fact_sheets").dropColumn("input_hash").execute();
}
