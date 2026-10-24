import type { Sport } from "@voita_kone/shared_types";
import { sql } from "kysely";
import type { Database } from "../../db/kysely";
import {
  KyselyScorePredictionsRepository,
  SCORABLE_GAME_COLUMNS,
  to_scorable_game,
  type GoalRow,
  type ScorableGame,
} from "../../jobs/score_predictions_repository";
import type { LeaderboardAnswerPoints, LeaderboardPick } from "./leaderboard_builder";

export interface SeasonGameRow extends ScorableGame {
  start_time: Date;
}

/** One sport's current season (each sport counts its own seasons, e.g. "2026-27" and "2026"). */
export interface SportSeason {
  sport: Sport;
  season: string;
}

export interface LeaderboardRepository {
  /** The season of each sport's latest game; sports without games are left out. */
  find_current_seasons(sports: readonly Sport[]): Promise<SportSeason[]>;
  /** Finished games of these sports' seasons (demo fill-ins and sample games too). */
  list_final_games(seasons: readonly SportSeason[]): Promise<SeasonGameRow[]>;
  list_goals(game_ids: readonly string[]): Promise<GoalRow[]>;
  /** Scored picks of these games, with the user's display name. */
  list_scored_picks(game_ids: readonly string[]): Promise<LeaderboardPick[]>;
  /** Points from scored answers per user and game (live picks, quiz, vote). */
  list_answer_points(game_ids: readonly string[]): Promise<LeaderboardAnswerPoints[]>;
}

export class KyselyLeaderboardRepository implements LeaderboardRepository {
  // Goals are read the same way as for scoring.
  private readonly scoring: KyselyScorePredictionsRepository;

  constructor(private readonly db: Database) {
    this.scoring = new KyselyScorePredictionsRepository(db);
  }

  async find_current_seasons(sports: readonly Sport[]): Promise<SportSeason[]> {
    if (sports.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom("games")
      .distinctOn("sport")
      .select(["sport", "season"])
      .where("sport", "in", sports)
      .orderBy("sport")
      .orderBy("start_time", "desc")
      .execute();
    return rows.flatMap((row) => {
      const sport = sports.find((candidate) => candidate === row.sport);
      return sport ? [{ sport, season: row.season }] : [];
    });
  }

  async list_final_games(seasons: readonly SportSeason[]): Promise<SeasonGameRow[]> {
    if (seasons.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom("games")
      .select([...SCORABLE_GAME_COLUMNS, "games.start_time"])
      .where((eb) =>
        eb.or(
          seasons.map(({ sport, season }) =>
            eb.and([eb("games.sport", "=", sport), eb("games.season", "=", season)]),
          ),
        ),
      )
      .where("games.status", "=", "final")
      .where("games.home_goals", "is not", null)
      .where("games.away_goals", "is not", null)
      .execute();
    return rows.map((row) => ({ ...to_scorable_game(row), start_time: row.start_time }));
  }

  list_goals(game_ids: readonly string[]): Promise<GoalRow[]> {
    return this.scoring.list_goals(game_ids);
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
