import { sql, type Kysely } from "kysely";

// Step 3: what the prediction model needs to store to be repeatable and to drive the
// live win chance (expected goals) and the stakes / odds cards.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("model_runs")
    .addColumn("season", "text", (column) => column.notNull().defaultTo(""))
    .addColumn("seed", "integer", (column) => column.notNull().defaultTo(0))
    .addColumn("duration_ms", "integer", (column) => column.check(sql`duration_ms >= 0`))
    .execute();
  await db.schema
    .createIndex("model_runs_input_hash_index")
    .on("model_runs")
    .column("input_hash")
    .execute();

  await db.schema
    .alterTable("ai_predictions")
    .addColumn("overtime_probability", "double precision", (column) =>
      column
        .notNull()
        .defaultTo(0)
        .check(sql`overtime_probability BETWEEN 0 AND 1`),
    )
    .addColumn("expected_home_goals", "double precision", (column) =>
      column
        .notNull()
        .defaultTo(0)
        .check(sql`expected_home_goals >= 0`),
    )
    .addColumn("expected_away_goals", "double precision", (column) =>
      column
        .notNull()
        .defaultTo(0)
        .check(sql`expected_away_goals >= 0`),
    )
    .addColumn("overtime_home_share", "double precision", (column) =>
      column
        .notNull()
        .defaultTo(0.5)
        .check(sql`overtime_home_share BETWEEN 0 AND 1`),
    )
    // { recent_goals, recent_games, season_goals } of the predicted scorer.
    .addColumn("predicted_top_scorer_form", "jsonb")
    .execute();
  await db.schema
    .createIndex("ai_predictions_game_id_index")
    .on("ai_predictions")
    .column("game_id")
    .execute();

  await db.schema
    .alterTable("team_season_odds")
    .addColumn("top_spots_probability", "double precision", (column) =>
      column
        .notNull()
        .defaultTo(0)
        .check(sql`top_spots_probability BETWEEN 0 AND 1`),
    )
    .addColumn("expected_points", "double precision", (column) => column.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("team_season_odds")
    .dropColumn("expected_points")
    .dropColumn("top_spots_probability")
    .execute();
  await db.schema.dropIndex("ai_predictions_game_id_index").execute();
  await db.schema
    .alterTable("ai_predictions")
    .dropColumn("predicted_top_scorer_form")
    .dropColumn("overtime_home_share")
    .dropColumn("expected_away_goals")
    .dropColumn("expected_home_goals")
    .dropColumn("overtime_probability")
    .execute();
  await db.schema.dropIndex("model_runs_input_hash_index").execute();
  await db.schema
    .alterTable("model_runs")
    .dropColumn("duration_ms")
    .dropColumn("seed")
    .dropColumn("season")
    .execute();
}
