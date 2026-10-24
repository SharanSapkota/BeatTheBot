import { sql, type Kysely } from "kysely";

// Live state from Liiga: the current (or last) period and, while live, the game clock.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("games")
    .addColumn("period", "integer", (column) => column.check(sql`period BETWEEN 1 AND 5`))
    .addColumn("game_clock_seconds", "integer", (column) =>
      column.check(sql`game_clock_seconds >= 0`),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("games")
    .dropColumn("game_clock_seconds")
    .dropColumn("period")
    .execute();
}
