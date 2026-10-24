import type { EndedIn } from "@voita_kone/scoring";
import type { Database } from "../db/kysely";

export interface ScorableGame {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_goals: number;
  away_goals: number;
  ended_in: EndedIn | null;
}

export interface GoalRow {
  game_id: string;
  team_id: string | null;
  player_id: string | null;
  period: number;
}

export interface AiPickRow {
  game_id: string;
  winner_team_id: string;
  home_goals: number;
  away_goals: number;
  scorer_id: string | null;
}

export interface UnscoredPrediction {
  id: string;
  game_id: string;
  winner_team_id: string;
  home_goals: number;
  away_goals: number;
  scorer_id: string | null;
}

export interface ScoreUpdate {
  prediction_id: string;
  points_awarded: number;
}

export interface ScorePredictionsRepository {
  /** Final games that still have unscored before-game picks. */
  find_games_to_score(): Promise<ScorableGame[]>;
  /** Goals of these games, in time order. */
  list_goals(game_ids: readonly string[]): Promise<GoalRow[]>;
  /** The AI's latest pre-game pick per game (started games keep their pick). */
  list_ai_picks(game_ids: readonly string[]): Promise<AiPickRow[]>;
  list_unscored_predictions(game_ids: readonly string[]): Promise<UnscoredPrediction[]>;
  save_points(updates: readonly ScoreUpdate[], scored_at: Date): Promise<void>;
}

const ENDED_IN: readonly EndedIn[] = ["regulation", "overtime", "shootout"];

export function to_ended_in(value: string | null): EndedIn | null {
  return ENDED_IN.find((ended_in) => ended_in === value) ?? null;
}

export class KyselyScorePredictionsRepository implements ScorePredictionsRepository {
  constructor(private readonly db: Database) {}

  async find_games_to_score(): Promise<ScorableGame[]> {
    const rows = await this.db
      .selectFrom("games")
      .select(["id", "home_team_id", "away_team_id", "home_goals", "away_goals", "ended_in"])
      .where("status", "=", "final")
      .where("home_goals", "is not", null)
      .where("away_goals", "is not", null)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("user_predictions")
            .select("user_predictions.id")
            .whereRef("user_predictions.game_id", "=", "games.id")
            .where("user_predictions.scored_at", "is", null),
        ),
      )
      .execute();
    return rows.map((row) => ({
      ...row,
      home_goals: row.home_goals ?? 0,
      away_goals: row.away_goals ?? 0,
      ended_in: to_ended_in(row.ended_in),
    }));
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

  list_ai_picks(game_ids: readonly string[]): Promise<AiPickRow[]> {
    if (game_ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.db
      .selectFrom("ai_predictions")
      .innerJoin("model_runs", "model_runs.id", "ai_predictions.model_run_id")
      .distinctOn("ai_predictions.game_id")
      .select([
        "ai_predictions.game_id",
        "ai_predictions.predicted_winner_team_id as winner_team_id",
        "ai_predictions.predicted_home_goals as home_goals",
        "ai_predictions.predicted_away_goals as away_goals",
        "ai_predictions.predicted_top_scorer_id as scorer_id",
      ])
      .where("ai_predictions.game_id", "in", game_ids)
      .orderBy("ai_predictions.game_id")
      .orderBy("model_runs.run_at", "desc")
      .execute();
  }

  list_unscored_predictions(game_ids: readonly string[]): Promise<UnscoredPrediction[]> {
    if (game_ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.db
      .selectFrom("user_predictions")
      .select([
        "id",
        "game_id",
        "predicted_winner_team_id as winner_team_id",
        "predicted_home_goals as home_goals",
        "predicted_away_goals as away_goals",
        "predicted_scorer_id as scorer_id",
      ])
      .where("game_id", "in", game_ids)
      .where("scored_at", "is", null)
      .execute();
  }

  async save_points(updates: readonly ScoreUpdate[], scored_at: Date): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    await this.db.transaction().execute(async (trx) => {
      for (const update of updates) {
        await trx
          .updateTable("user_predictions")
          .set({ points_awarded: update.points_awarded, scored_at })
          .where("id", "=", update.prediction_id)
          .execute();
      }
    });
  }
}
