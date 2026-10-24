import { sport_config, type EndedIn, type MarginBand, type SportId } from "@voita_kone/scoring";
import { sql } from "kysely";
import type { Database } from "../db/kysely";

export interface ScorableGame {
  id: string;
  sport: SportId;
  home_team_id: string;
  away_team_id: string;
  home_goals: number;
  away_goals: number;
  ended_in: EndedIn | null;
  /** Basketball: the top scorer entered with the result. */
  top_scorer_id: string | null;
}

export interface GoalRow {
  game_id: string;
  team_id: string | null;
  player_id: string | null;
  period: number;
}

/** Fan picks per winner team of one game (all picks are made before puck drop); null = draw. */
export interface CrowdRow {
  game_id: string;
  winner_team_id: string | null;
  pick_count: number;
}

export interface UnscoredPrediction {
  id: string;
  game_id: string;
  /** Null = a draw (football). */
  winner_team_id: string | null;
  home_goals: number | null;
  away_goals: number | null;
  scorer_id: string | null;
  margin_band: MarginBand | null;
}

export interface ScoreUpdate {
  prediction_id: string;
  points_awarded: number;
}

/**
 * The version of the scoring rules; picks scored with an older version are scored again.
 * 2 = fans vs fans (bold call instead of "beat the AI"); 3 = per-sport picks (step 8).
 */
export const SCORING_VERSION = 3;

export interface ScorePredictionsRepository {
  /** Final games with picks that are unscored or scored with older rules. */
  find_games_to_score(): Promise<ScorableGame[]>;
  /** Goals of these games, in time order. */
  list_goals(game_ids: readonly string[]): Promise<GoalRow[]>;
  /** How all fans picked the winner of these games (for the bold call). */
  list_crowd(game_ids: readonly string[]): Promise<CrowdRow[]>;
  list_unscored_predictions(game_ids: readonly string[]): Promise<UnscoredPrediction[]>;
  save_points(updates: readonly ScoreUpdate[], scored_at: Date): Promise<void>;
}

const ENDED_IN: readonly EndedIn[] = ["regulation", "overtime", "shootout"];

export function to_ended_in(value: string | null): EndedIn | null {
  return ENDED_IN.find((ended_in) => ended_in === value) ?? null;
}

const MARGIN_BANDS: readonly MarginBand[] = ["1_5", "6_10", "11_plus"];

export function to_margin_band(value: string | null): MarginBand | null {
  return MARGIN_BANDS.find((band) => band === value) ?? null;
}

/** A finished game row in the shape scoring needs. */
export function to_scorable_game(row: {
  id: string;
  sport: string;
  home_team_id: string;
  away_team_id: string;
  home_goals: number | null;
  away_goals: number | null;
  ended_in: string | null;
  top_scorer_player_id: string | null;
}): ScorableGame {
  return {
    id: row.id,
    sport: sport_config(row.sport).id,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    home_goals: row.home_goals ?? 0,
    away_goals: row.away_goals ?? 0,
    ended_in: to_ended_in(row.ended_in),
    top_scorer_id: row.top_scorer_player_id,
  };
}

/** The columns `to_scorable_game` reads. */
export const SCORABLE_GAME_COLUMNS = [
  "games.id",
  "games.sport",
  "games.home_team_id",
  "games.away_team_id",
  "games.home_goals",
  "games.away_goals",
  "games.ended_in",
  "games.top_scorer_player_id",
] as const;

export class KyselyScorePredictionsRepository implements ScorePredictionsRepository {
  constructor(private readonly db: Database) {}

  async find_games_to_score(): Promise<ScorableGame[]> {
    const rows = await this.db
      .selectFrom("games")
      .select(SCORABLE_GAME_COLUMNS)
      .where("status", "=", "final")
      .where("home_goals", "is not", null)
      .where("away_goals", "is not", null)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("user_predictions")
            .select("user_predictions.id")
            .whereRef("user_predictions.game_id", "=", "games.id")
            .where((inner) =>
              inner.or([
                inner("user_predictions.scored_at", "is", null),
                inner("user_predictions.scoring_version", "<", SCORING_VERSION),
              ]),
            ),
        ),
      )
      .execute();
    return rows.map(to_scorable_game);
  }

  list_goals(game_ids: readonly string[]): Promise<GoalRow[]> {
    if (game_ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.db
      .selectFrom("game_events")
      .select(["game_id", "team_id", "player_id", "period"])
      .where("game_id", "in", game_ids)
      .where("event_type", "=", "goal")
      .orderBy("game_id")
      .orderBy("period")
      .orderBy("game_time_seconds")
      .execute();
  }

  async list_crowd(game_ids: readonly string[]): Promise<CrowdRow[]> {
    if (game_ids.length === 0) {
      return [];
    }
    return this.db
      .selectFrom("user_predictions")
      .select([
        "game_id",
        "predicted_winner_team_id as winner_team_id",
        sql<number>`count(*)::int`.as("pick_count"),
      ])
      .where("game_id", "in", game_ids)
      .groupBy(["game_id", "predicted_winner_team_id"])
      .execute();
  }

  async list_unscored_predictions(game_ids: readonly string[]): Promise<UnscoredPrediction[]> {
    if (game_ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom("user_predictions")
      .select([
        "id",
        "game_id",
        "predicted_winner_team_id as winner_team_id",
        "predicted_home_goals as home_goals",
        "predicted_away_goals as away_goals",
        "predicted_scorer_id as scorer_id",
        "predicted_margin_band",
      ])
      .where("game_id", "in", game_ids)
      .where((eb) =>
        eb.or([eb("scored_at", "is", null), eb("scoring_version", "<", SCORING_VERSION)]),
      )
      .execute();
    return rows.map(({ predicted_margin_band, ...row }) => ({
      ...row,
      margin_band: to_margin_band(predicted_margin_band),
    }));
  }

  async save_points(updates: readonly ScoreUpdate[], scored_at: Date): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    await this.db.transaction().execute(async (trx) => {
      for (const update of updates) {
        await trx
          .updateTable("user_predictions")
          .set({
            points_awarded: update.points_awarded,
            scored_at,
            scoring_version: SCORING_VERSION,
          })
          .where("id", "=", update.prediction_id)
          .execute();
      }
    });
  }
}
