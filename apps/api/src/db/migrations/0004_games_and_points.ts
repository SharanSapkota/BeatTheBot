import { sql, type Kysely } from "kysely";
import { add_updated_at_trigger, is_one_of, with_id, with_timestamps } from "../migration_helpers";

const TABLES = ["user_predictions", "questions", "user_answers", "leagues", "league_members"];

const QUESTION_TYPES = [
  "next_goal",
  "period_goal",
  "result_quiz",
  "question_of_day",
  "brain_calculator",
  "higher_lower",
  "quiz",
  "player_vote",
  "poll",
];

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("user_predictions")
    .$call(with_id)
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("game_id", "uuid", (column) =>
      column.notNull().references("games.id").onDelete("cascade"),
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
    .addColumn("predicted_scorer_id", "uuid", (column) =>
      column.references("players.id").onDelete("set null"),
    )
    .addColumn("points_awarded", "integer")
    .addColumn("scored_at", "timestamptz")
    .$call(with_timestamps)
    .addUniqueConstraint("user_predictions_user_id_game_id_unique", ["user_id", "game_id"])
    .execute();
  await db.schema
    .createIndex("user_predictions_game_id_index")
    .on("user_predictions")
    .column("game_id")
    .execute();

  await db.schema
    .createTable("questions")
    .$call(with_id)
    .addColumn("game_id", "uuid", (column) => column.references("games.id").onDelete("cascade"))
    .addColumn("phase", "text", (column) =>
      column.notNull().check(is_one_of("phase", ["live", "after", "daily"])),
    )
    .addColumn("question_type", "text", (column) =>
      column.notNull().check(is_one_of("question_type", QUESTION_TYPES)),
    )
    .addColumn("prompt", "jsonb", (column) => column.notNull())
    .addColumn("options", "jsonb", (column) => column.notNull())
    .addColumn("correct_option", "text")
    .addColumn("points", "integer", (column) =>
      column
        .notNull()
        .defaultTo(0)
        .check(sql`points >= 0`),
    )
    .addColumn("fact_ids", "jsonb", (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("opens_at", "timestamptz", (column) => column.notNull())
    .addColumn("locks_at", "timestamptz", (column) => column.notNull())
    .addColumn("status", "text", (column) =>
      column
        .notNull()
        .defaultTo("draft")
        .check(is_one_of("status", ["draft", "in_review", "live", "closed"])),
    )
    .$call(with_timestamps)
    .addCheckConstraint(
      "questions_game_id_matches_phase_check",
      sql`(phase = 'daily') = (game_id IS NULL)`,
    )
    .execute();
  await db.schema
    .createIndex("questions_game_id_index")
    .on("questions")
    .column("game_id")
    .execute();

  await db.schema
    .createTable("user_answers")
    .$call(with_id)
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("question_id", "uuid", (column) =>
      column.notNull().references("questions.id").onDelete("cascade"),
    )
    .addColumn("answer", "text", (column) => column.notNull())
    .addColumn("points_awarded", "integer")
    .addColumn("answered_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .$call(with_timestamps)
    // The unique (user_id, question_id) index also covers lookups by user_id.
    .addUniqueConstraint("user_answers_user_id_question_id_unique", ["user_id", "question_id"])
    .execute();
  await db.schema
    .createIndex("user_answers_question_id_index")
    .on("user_answers")
    .column("question_id")
    .execute();

  await db.schema
    .createTable("leagues")
    .$call(with_id)
    .addColumn("name", "text", (column) => column.notNull())
    .addColumn("owner_user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("invite_code", "text", (column) => column.notNull().unique())
    .$call(with_timestamps)
    .execute();

  await db.schema
    .createTable("league_members")
    .$call(with_id)
    .addColumn("league_id", "uuid", (column) =>
      column.notNull().references("leagues.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .$call(with_timestamps)
    .addUniqueConstraint("league_members_league_id_user_id_unique", ["league_id", "user_id"])
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
