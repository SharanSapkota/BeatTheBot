import type { QuestionType } from "@voita_kone/scoring";
import { question_type_schema } from "@voita_kone/shared_types";
import type { Database } from "../db/kysely";
import { KyselyScorePredictionsRepository, type GoalRow } from "./score_predictions_repository";

export interface OpenLiveQuestion {
  id: string;
  game_id: string;
  question_type: QuestionType;
  target: number | null;
}

export interface LiveGameRow {
  id: string;
  home_team_id: string;
  away_team_id: string;
  period: number | null;
  status: string;
}

export interface UnscoredAnswer {
  id: string;
  answer: string;
  question_type: QuestionType;
  correct_option: string | null;
}

export interface AnswerPoints {
  answer_id: string;
  points_awarded: number;
}

export interface ScoreAnswersRepository {
  /** Next-goal and period-goal questions without a right answer yet, of started games. */
  list_open_live_questions(): Promise<OpenLiveQuestion[]>;
  list_games(game_ids: readonly string[]): Promise<LiveGameRow[]>;
  list_goals(game_ids: readonly string[]): Promise<GoalRow[]>;
  close_questions(
    decided: readonly { question_id: string; correct_option: string }[],
  ): Promise<void>;
  /** Answers without points whose question is decided (or needs no right answer). */
  list_unscored_answers(): Promise<UnscoredAnswer[]>;
  save_points(updates: readonly AnswerPoints[]): Promise<void>;
}

export class KyselyScoreAnswersRepository implements ScoreAnswersRepository {
  private readonly scoring: KyselyScorePredictionsRepository;

  constructor(private readonly db: Database) {
    this.scoring = new KyselyScorePredictionsRepository(db);
  }

  async list_open_live_questions(): Promise<OpenLiveQuestion[]> {
    const rows = await this.db
      .selectFrom("questions")
      .innerJoin("games", "games.id", "questions.game_id")
      .select([
        "questions.id",
        "games.id as game_id",
        "questions.question_type",
        "questions.target",
      ])
      .where("questions.question_type", "in", ["next_goal", "period_goal"])
      .where("questions.correct_option", "is", null)
      .where("questions.status", "=", "live")
      .where("games.status", "in", ["live", "final"])
      .execute();
    return rows.map((row) => ({
      ...row,
      question_type: question_type_schema.parse(row.question_type),
    }));
  }

  list_games(game_ids: readonly string[]): Promise<LiveGameRow[]> {
    if (game_ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.db
      .selectFrom("games")
      .select(["id", "home_team_id", "away_team_id", "period", "status"])
      .where("id", "in", game_ids)
      .execute();
  }

  list_goals(game_ids: readonly string[]): Promise<GoalRow[]> {
    return this.scoring.list_goals(game_ids);
  }

  async close_questions(
    decided: readonly { question_id: string; correct_option: string }[],
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      for (const { question_id, correct_option } of decided) {
        await trx
          .updateTable("questions")
          .set({ correct_option, status: "closed" })
          .where("id", "=", question_id)
          .where("correct_option", "is", null)
          .execute();
      }
    });
  }

  async list_unscored_answers(): Promise<UnscoredAnswer[]> {
    const rows = await this.db
      .selectFrom("user_answers")
      .innerJoin("questions", "questions.id", "user_answers.question_id")
      .select([
        "user_answers.id",
        "user_answers.answer",
        "questions.question_type",
        "questions.correct_option",
      ])
      .where("user_answers.points_awarded", "is", null)
      .where((eb) =>
        eb.or([
          eb("questions.correct_option", "is not", null),
          eb("questions.question_type", "in", ["player_vote", "poll"]),
        ]),
      )
      .execute();
    return rows.map((row) => ({
      ...row,
      question_type: question_type_schema.parse(row.question_type),
    }));
  }

  async save_points(updates: readonly AnswerPoints[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    await this.db.transaction().execute(async (trx) => {
      for (const { answer_id, points_awarded } of updates) {
        await trx
          .updateTable("user_answers")
          .set({ points_awarded })
          .where("id", "=", answer_id)
          .where("points_awarded", "is", null)
          .execute();
      }
    });
  }
}
