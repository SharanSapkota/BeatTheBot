import { sql, type Kysely } from "kysely";
import {
  add_updated_at_trigger,
  is_one_of,
  with_data_source,
  with_id,
  with_timestamps,
} from "../migration_helpers";

const TABLES = ["teams", "players", "games", "game_events", "standings_snapshots"];

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  await db.schema
    .createTable("teams")
    .$call(with_id)
    .addColumn("external_id", "text", (column) => column.notNull().unique())
    .addColumn("name", "text", (column) => column.notNull())
    .addColumn("short_name", "text", (column) => column.notNull())
    // Liiga has no city per team; it comes from the home rink, so it can be missing.
    .addColumn("city", "text")
    .addColumn("logo_url", "text")
    .$call(with_data_source)
    .$call(with_timestamps)
    .execute();

  await db.schema
    .createTable("players")
    .$call(with_id)
    .addColumn("external_id", "text", (column) => column.notNull().unique())
    .addColumn("team_id", "uuid", (column) =>
      column.notNull().references("teams.id").onDelete("restrict"),
    )
    .addColumn("first_name", "text", (column) => column.notNull())
    .addColumn("last_name", "text", (column) => column.notNull())
    .addColumn("jersey_number", "integer", (column) =>
      column.check(sql`jersey_number BETWEEN 1 AND 99`),
    )
    // Liiga only gives forward / defense / goalie, and a few players have no role.
    .addColumn("position", "text", (column) =>
      column.check(is_one_of("position", ["goalie", "defense", "forward"])),
    )
    .addColumn("birth_year", "integer")
    .$call(with_data_source)
    .$call(with_timestamps)
    .execute();

  await db.schema
    .createTable("games")
    .$call(with_id)
    .addColumn("external_id", "text", (column) => column.notNull().unique())
    .addColumn("season", "text", (column) => column.notNull())
    .addColumn("home_team_id", "uuid", (column) =>
      column.notNull().references("teams.id").onDelete("restrict"),
    )
    .addColumn("away_team_id", "uuid", (column) =>
      column.notNull().references("teams.id").onDelete("restrict"),
    )
    .addColumn("start_time", "timestamptz", (column) => column.notNull())
    .addColumn("status", "text", (column) =>
      column
        .notNull()
        .defaultTo("scheduled")
        .check(is_one_of("status", ["scheduled", "live", "final"])),
    )
    .addColumn("home_goals", "integer", (column) => column.check(sql`home_goals >= 0`))
    .addColumn("away_goals", "integer", (column) => column.check(sql`away_goals >= 0`))
    .addColumn("ended_in", "text", (column) =>
      column.check(is_one_of("ended_in", ["regulation", "overtime", "shootout"])),
    )
    .$call(with_data_source)
    .$call(with_timestamps)
    .addCheckConstraint("games_different_teams_check", sql`home_team_id <> away_team_id`)
    .addCheckConstraint(
      "games_final_has_result_check",
      sql`status <> 'final' OR (home_goals IS NOT NULL AND away_goals IS NOT NULL AND ended_in IS NOT NULL)`,
    )
    .execute();
  await db.schema.createIndex("games_start_time_index").on("games").column("start_time").execute();
  await db.schema.createIndex("games_status_index").on("games").column("status").execute();

  // period: 1-3 regulation, 4 overtime, 5 shootout.
  // game_time_seconds: seconds since the start of the game (2nd period 05:12 = 1512).
  await db.schema
    .createTable("game_events")
    .$call(with_id)
    .addColumn("game_id", "uuid", (column) =>
      column.notNull().references("games.id").onDelete("cascade"),
    )
    .addColumn("event_type", "text", (column) =>
      column
        .notNull()
        .check(
          is_one_of("event_type", ["goal", "penalty", "period_start", "period_end", "game_end"]),
        ),
    )
    .addColumn("period", "integer", (column) => column.notNull().check(sql`period BETWEEN 1 AND 5`))
    .addColumn("game_time_seconds", "integer", (column) =>
      column.notNull().check(sql`game_time_seconds >= 0`),
    )
    .addColumn("team_id", "uuid", (column) => column.references("teams.id").onDelete("restrict"))
    .addColumn("player_id", "uuid", (column) =>
      column.references("players.id").onDelete("set null"),
    )
    .addColumn("assist_player_ids", sql`uuid[]`, (column) =>
      column.notNull().defaultTo(sql`'{}'::uuid[]`),
    )
    .addColumn("raw", "jsonb")
    .$call(with_data_source)
    .$call(with_timestamps)
    .execute();
  await db.schema
    .createIndex("game_events_game_id_index")
    .on("game_events")
    .column("game_id")
    .execute();

  await db.schema
    .createTable("standings_snapshots")
    .$call(with_id)
    .addColumn("season", "text", (column) => column.notNull())
    .addColumn("taken_at", "timestamptz", (column) => column.notNull())
    .addColumn("team_id", "uuid", (column) =>
      column.notNull().references("teams.id").onDelete("restrict"),
    )
    .addColumn("games_played", "integer", (column) => column.notNull())
    .addColumn("points", "integer", (column) => column.notNull())
    .addColumn("goals_for", "integer", (column) => column.notNull())
    .addColumn("goals_against", "integer", (column) => column.notNull())
    .addColumn("rank", "integer", (column) => column.notNull())
    .$call(with_data_source)
    .$call(with_timestamps)
    .addUniqueConstraint("standings_snapshots_season_taken_at_team_id_unique", [
      "season",
      "taken_at",
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
  await sql`DROP FUNCTION set_updated_at()`.execute(db);
}
