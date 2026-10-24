import { sql, type Kysely } from "kysely";
import { add_updated_at_trigger, with_id, with_timestamps } from "../migration_helpers";

const TABLES = ["model_runs", "ai_predictions", "team_season_odds"];

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("model_runs")
    .$call(with_id)
    .addColumn("run_at", "timestamptz", (column) => column.notNull())
    .addColumn("model_version", "text", (column) => column.notNull())
    .addColumn("simulations", "integer", (column) => column.notNull().check(sql`simulations > 0`))
    .addColumn("input_hash", "text", (column) => column.notNull())
    .$call(with_timestamps)
    .execute();

  await db.schema
    .createTable("ai_predictions")
    .$call(with_id)
    .addColumn("game_id", "uuid", (column) =>
      column.notNull().references("games.id").onDelete("cascade"),
    )
    .addColumn("model_run_id", "uuid", (column) =>
      column.notNull().references("model_runs.id").onDelete("cascade"),
    )
    .addColumn("home_win_probability", "double precision", (column) =>
      column.notNull().check(sql`home_win_probability BETWEEN 0 AND 1`),
    )
    .addColumn("away_win_probability", "double precision", (column) =>
      column.notNull().check(sql`away_win_probability BETWEEN 0 AND 1`),
    )
    .addColumn("predicted_winner_team_id", "uuid", (column) =>
      column.notNull().references("teams.id").onDelete("restrict"),
    )
    .addColumn("predicted_home_goals", "integer", (column) =>
      column.notNull().check(sql`predicted_home_goals >= 0`),
    )
    .addColumn("predicted_away_goals", "integer", (column) =>
      column.notNull().check(sql`predicted_away_goals >= 0`),
    )
    .addColumn("predicted_top_scorer_id", "uuid", (column) =>
      column.references("players.id").onDelete("set null"),
    )
    .addColumn("reasons", "jsonb", (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("stakes", "jsonb", (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .$call(with_timestamps)
    .addUniqueConstraint("ai_predictions_game_id_model_run_id_unique", ["game_id", "model_run_id"])
    .execute();

  await db.schema
    .createTable("team_season_odds")
    .$call(with_id)
    .addColumn("model_run_id", "uuid", (column) =>
      column.notNull().references("model_runs.id").onDelete("cascade"),
    )
    .addColumn("team_id", "uuid", (column) =>
      column.notNull().references("teams.id").onDelete("restrict"),
    )
    .addColumn("playoff_probability", "double precision", (column) =>
      column.notNull().check(sql`playoff_probability BETWEEN 0 AND 1`),
    )
    .addColumn("relegation_probability", "double precision", (column) =>
      column.notNull().check(sql`relegation_probability BETWEEN 0 AND 1`),
    )
    .$call(with_timestamps)
    .addUniqueConstraint("team_season_odds_model_run_id_team_id_unique", [
      "model_run_id",
      "team_id",
    ])
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
