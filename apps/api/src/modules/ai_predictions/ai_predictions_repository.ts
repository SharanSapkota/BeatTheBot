import { jsonObjectFrom } from "kysely/helpers/postgres";
import type { Json } from "../../db/database_types";
import type { Database } from "../../db/kysely";
import type { TeamRow } from "../teams/teams_mapper";

export interface ScorerRow {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}

export interface StoredPredictionRow {
  game_id: string;
  predicted_winner_team_id: string;
  home_win_probability: number;
  away_win_probability: number;
  overtime_probability: number;
  predicted_home_goals: number;
  predicted_away_goals: number;
  expected_home_goals: number;
  expected_away_goals: number;
  overtime_home_share: number;
  reasons: Json;
  stakes: Json;
  scorer_form: Json | null;
  scorer: ScorerRow | null;
  model_version: string;
  /** When the model run that made it started. */
  calculated_at: Date;
}

export interface CrowdCounts {
  home_picks: number;
  /** Football: picks with no winner (a draw). */
  draw_picks: number;
  total_picks: number;
}

export interface NewModelRun {
  run_at: Date;
  model_version: string;
  season: string;
  simulations: number;
  seed: number;
  input_hash: string;
  duration_ms: number;
}

export interface NewPrediction {
  game_id: string;
  predicted_winner_team_id: string;
  home_win_probability: number;
  away_win_probability: number;
  overtime_probability: number;
  predicted_home_goals: number;
  predicted_away_goals: number;
  expected_home_goals: number;
  expected_away_goals: number;
  overtime_home_share: number;
  predicted_top_scorer_id: string | null;
  predicted_top_scorer_form: Json | null;
  reasons: Json;
  stakes: Json;
}

export interface NewTeamOdds {
  team_id: string;
  playoff_probability: number;
  top_spots_probability: number;
  relegation_probability: number;
  expected_points: number;
}

export interface SeasonOddsRows {
  season: string;
  model_version: string;
  simulations: number;
  run_at: Date;
  rows: (Omit<NewTeamOdds, "team_id"> & { team: TeamRow })[];
}

export interface AiPredictionsRepository {
  /** The newest stored prediction for the game (from the latest run that predicted it). */
  find_latest_prediction(game_id: string): Promise<StoredPredictionRow | undefined>;
  /** User picks for the game: how many picked the home team, and all picks. */
  count_crowd_picks(game_id: string, home_team_id: string): Promise<CrowdCounts>;
  find_latest_season_odds(): Promise<SeasonOddsRows | undefined>;
  has_run_with_hash(input_hash: string): Promise<boolean>;
  /** Which of the games already have a stored prediction. */
  list_predicted_game_ids(game_ids: readonly string[]): Promise<Set<string>>;
  /** Stores a run, its predictions and its season odds in one transaction; returns the run id. */
  save_run(
    run: NewModelRun,
    predictions: readonly NewPrediction[],
    odds: readonly NewTeamOdds[],
  ): Promise<string>;
}

/** jsonb values go in as JSON text, so pg never turns arrays into Postgres arrays. */
function to_jsonb(value: Json): string {
  return JSON.stringify(value);
}

export class KyselyAiPredictionsRepository implements AiPredictionsRepository {
  constructor(private readonly db: Database) {}

  find_latest_prediction(game_id: string): Promise<StoredPredictionRow | undefined> {
    return this.db
      .selectFrom("ai_predictions")
      .innerJoin("model_runs", "model_runs.id", "ai_predictions.model_run_id")
      .select((eb) => [
        "ai_predictions.game_id",
        "ai_predictions.predicted_winner_team_id",
        "ai_predictions.home_win_probability",
        "ai_predictions.away_win_probability",
        "ai_predictions.overtime_probability",
        "ai_predictions.predicted_home_goals",
        "ai_predictions.predicted_away_goals",
        "ai_predictions.expected_home_goals",
        "ai_predictions.expected_away_goals",
        "ai_predictions.overtime_home_share",
        "ai_predictions.reasons",
        "ai_predictions.stakes",
        "ai_predictions.predicted_top_scorer_form as scorer_form",
        jsonObjectFrom(
          eb
            .selectFrom("players")
            .select([
              "players.id",
              "players.team_id",
              "players.first_name",
              "players.last_name",
              "players.jersey_number",
            ])
            .whereRef("players.id", "=", "ai_predictions.predicted_top_scorer_id"),
        ).as("scorer"),
        "model_runs.model_version",
        "model_runs.run_at as calculated_at",
      ])
      .where("ai_predictions.game_id", "=", game_id)
      .orderBy("model_runs.run_at", "desc")
      .limit(1)
      .executeTakeFirst();
  }

  async count_crowd_picks(game_id: string, home_team_id: string): Promise<CrowdCounts> {
    const row = await this.db
      .selectFrom("user_predictions")
      .select((eb) => [
        eb.fn.countAll<string>().as("total_picks"),
        eb.fn
          .count<string>("user_predictions.id")
          .filterWhere("user_predictions.predicted_winner_team_id", "=", home_team_id)
          .as("home_picks"),
        eb.fn
          .count<string>("user_predictions.id")
          .filterWhere("user_predictions.predicted_winner_team_id", "is", null)
          .as("draw_picks"),
      ])
      .where("user_predictions.game_id", "=", game_id)
      .executeTakeFirstOrThrow();
    return {
      home_picks: Number(row.home_picks),
      draw_picks: Number(row.draw_picks),
      total_picks: Number(row.total_picks),
    };
  }

  async find_latest_season_odds(): Promise<SeasonOddsRows | undefined> {
    const run = await this.db
      .selectFrom("model_runs")
      .select(["id", "season", "model_version", "simulations", "run_at"])
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("team_season_odds")
            .select("team_season_odds.id")
            .whereRef("team_season_odds.model_run_id", "=", "model_runs.id"),
        ),
      )
      .orderBy("run_at", "desc")
      .limit(1)
      .executeTakeFirst();
    if (!run) {
      return undefined;
    }
    const rows = await this.db
      .selectFrom("team_season_odds")
      .innerJoin("teams", "teams.id", "team_season_odds.team_id")
      .select([
        "team_season_odds.playoff_probability",
        "team_season_odds.top_spots_probability",
        "team_season_odds.relegation_probability",
        "team_season_odds.expected_points",
        "teams.id",
        "teams.external_id",
        "teams.name",
        "teams.short_name",
        "teams.city",
        "teams.logo_url",
        "teams.sport",
        "teams.data_source",
      ])
      .where("team_season_odds.model_run_id", "=", run.id)
      .execute();
    return {
      season: run.season,
      model_version: run.model_version,
      simulations: run.simulations,
      run_at: run.run_at,
      rows: rows.map((row) => ({
        playoff_probability: row.playoff_probability,
        top_spots_probability: row.top_spots_probability,
        relegation_probability: row.relegation_probability,
        expected_points: row.expected_points,
        team: {
          id: row.id,
          external_id: row.external_id,
          name: row.name,
          short_name: row.short_name,
          city: row.city,
          logo_url: row.logo_url,
          sport: row.sport,
          data_source: row.data_source,
        },
      })),
    };
  }

  async has_run_with_hash(input_hash: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("model_runs")
      .select("id")
      .where("input_hash", "=", input_hash)
      .limit(1)
      .executeTakeFirst();
    return row !== undefined;
  }

  async list_predicted_game_ids(game_ids: readonly string[]): Promise<Set<string>> {
    if (game_ids.length === 0) {
      return new Set();
    }
    const rows = await this.db
      .selectFrom("ai_predictions")
      .select("game_id")
      .distinct()
      .where("game_id", "in", game_ids)
      .execute();
    return new Set(rows.map((row) => row.game_id));
  }

  save_run(
    run: NewModelRun,
    predictions: readonly NewPrediction[],
    odds: readonly NewTeamOdds[],
  ): Promise<string> {
    return this.db.transaction().execute(async (transaction) => {
      const { id: model_run_id } = await transaction
        .insertInto("model_runs")
        .values(run)
        .returning("id")
        .executeTakeFirstOrThrow();
      if (predictions.length > 0) {
        await transaction
          .insertInto("ai_predictions")
          .values(
            predictions.map((prediction) => ({
              ...prediction,
              model_run_id,
              reasons: to_jsonb(prediction.reasons),
              stakes: to_jsonb(prediction.stakes),
              predicted_top_scorer_form:
                prediction.predicted_top_scorer_form === null
                  ? null
                  : to_jsonb(prediction.predicted_top_scorer_form),
            })),
          )
          .execute();
      }
      if (odds.length > 0) {
        await transaction
          .insertInto("team_season_odds")
          .values(odds.map((row) => ({ ...row, model_run_id })))
          .execute();
      }
      return model_run_id;
    });
  }
}
