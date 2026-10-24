import type { Database } from "../../db/kysely";
import {
  KyselyScorePredictionsRepository,
  to_ended_in,
  type AiPickRow,
  type GoalRow,
  type ScorableGame,
} from "../../jobs/score_predictions_repository";
import { sql } from "kysely";
import type { LeaderboardAnswerPoints, LeaderboardPick } from "./leaderboard_builder";

export interface SeasonGameRow extends ScorableGame {
  start_time: Date;
}

export interface LeaderboardRepository {
  /** The season of the latest game, or undefined when there are no games. */
  find_current_season(): Promise<string | undefined>;
  /** Finished games of the season (demo fill-ins too: they have no AI pick). */
  list_final_games(season: string): Promise<SeasonGameRow[]>;
  list_goals(game_ids: readonly string[]): Promise<GoalRow[]>;
  list_ai_picks(game_ids: readonly string[]): Promise<AiPickRow[]>;
  /** Scored picks of these games, with the user's display name. */
  list_scored_picks(game_ids: readonly string[]): Promise<LeaderboardPick[]>;
  /** Points from scored answers per user and game (live picks, quiz, vote). */
  list_answer_points(game_ids: readonly string[]): Promise<LeaderboardAnswerPoints[]>;
}

export class KyselyLeaderboardRepository implements LeaderboardRepository {
  // Goals and AI picks are read the same way as for scoring.
  private readonly scoring: KyselyScorePredictionsRepository;

  constructor(private readonly db: Database) {
    this.scoring = new KyselyScorePredictionsRepository(db);
  }

  async find_current_season(): Promise<string | undefined> {
    const latest = await this.db
      .selectFrom("games")
      .select("season")
      .orderBy("start_time", "desc")
      .limit(1)
      .executeTakeFirst();
    return latest?.season;
  }

  async list_final_games(season: string): Promise<SeasonGameRow[]> {
    const rows = await this.db
      .selectFrom("games")
      .select([
        "id",
        "start_time",
        "home_team_id",
        "away_team_id",
        "home_goals",
        "away_goals",
        "ended_in",
      ])
      .where("season", "=", season)
      .where("status", "=", "final")
      .where("home_goals", "is not", null)
      .where("away_goals", "is not", null)
      .execute();
    return rows.map((row) => ({
      ...row,
      home_goals: row.home_goals ?? 0,
      away_goals: row.away_goals ?? 0,
      ended_in: to_ended_in(row.ended_in),
    }));
  }

  list_goals(game_ids: readonly string[]): Promise<GoalRow[]> {
    return this.scoring.list_goals(game_ids);
  }

  list_ai_picks(game_ids: readonly string[]): Promise<AiPickRow[]> {
    return this.scoring.list_ai_picks(game_ids);
  }

  async list_scored_picks(game_ids: readonly string[]): Promise<LeaderboardPick[]> {
    if (game_ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom("user_predictions")
      .innerJoin("users", "users.id", "user_predictions.user_id")
      .select([
        "user_predictions.user_id",
        "users.display_name",
        "user_predictions.game_id",
        "user_predictions.predicted_winner_team_id as winner_team_id",
        "user_predictions.points_awarded",
      ])
      .where("user_predictions.game_id", "in", game_ids)
      .where("user_predictions.points_awarded", "is not", null)
      .where("users.deleted_at", "is", null)
      .execute();
    return rows.map((row) => ({ ...row, points_awarded: row.points_awarded ?? 0 }));
  }

  async list_answer_points(game_ids: readonly string[]): Promise<LeaderboardAnswerPoints[]> {
    if (game_ids.length === 0) {
      return [];
    }
    return this.db
      .selectFrom("user_answers")
      .innerJoin("questions", "questions.id", "user_answers.question_id")
      .innerJoin("users", "users.id", "user_answers.user_id")
      .select([
        "user_answers.user_id",
        "users.display_name",
        "questions.game_id as game_id",
        sql<number>`sum(user_answers.points_awarded)::int`.as("points_awarded"),
      ])
      .where("questions.game_id", "in", game_ids)
      .where("user_answers.points_awarded", "is not", null)
      .where("users.deleted_at", "is", null)
      .groupBy(["user_answers.user_id", "users.display_name", "questions.game_id"])
      .execute()
      .then((rows) =>
        rows.flatMap((row) => (row.game_id === null ? [] : [{ ...row, game_id: row.game_id }])),
      );
  }
}
