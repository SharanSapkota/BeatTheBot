import type { Kysely } from "kysely";

// Step 5: the "what it means" story's template headline, and the audit trail that
// docs/content_generation.md asks for (model name and the raw LLM output).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("stories")
    .addColumn("headline", "text")
    .addColumn("model_name", "text")
    .addColumn("raw_output", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("stories")
    .dropColumn("headline")
    .dropColumn("model_name")
    .dropColumn("raw_output")
    .execute();
}
