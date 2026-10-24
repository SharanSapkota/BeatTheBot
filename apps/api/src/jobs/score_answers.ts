import {
  decide_next_goal,
  decide_period_goal,
  score_answer,
  type LiveGameState,
} from "@voita_kone/scoring";
import type { Logger } from "../common/logger";
import type {
  AnswerPoints,
  LiveGameRow,
  OpenLiveQuestion,
  ScoreAnswersRepository,
  UnscoredAnswer,
} from "./score_answers_repository";
import type { GoalRow } from "./score_predictions_repository";

export interface ScoreAnswersResult {
  closed_question_count: number;
  scored_answer_count: number;
}

function to_live_state(game: LiveGameRow, goals: readonly GoalRow[]): LiveGameState {
  return {
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    goals: goals.filter((goal) => goal.game_id === game.id),
    period: game.period,
    is_final: game.status === "final",
  };
}

/** The right answers of live questions that the game has decided by now. */
export function decide_questions(
  questions: readonly OpenLiveQuestion[],
  games: readonly LiveGameRow[],
  goals: readonly GoalRow[],
): { question_id: string; correct_option: string }[] {
  return questions.flatMap((question) => {
    const game = games.find((candidate) => candidate.id === question.game_id);
    if (!game) {
      return [];
    }
    const state = to_live_state(game, goals);
    const correct_option =
      question.question_type === "next_goal"
        ? decide_next_goal(state, question.target ?? 0)
        : decide_period_goal(state, question.target ?? 0);
    return correct_option === null ? [] : [{ question_id: question.id, correct_option }];
  });
}

export function score_answers(answers: readonly UnscoredAnswer[]): AnswerPoints[] {
  return answers.flatMap((answer) => {
    const points_awarded = score_answer(answer, answer.answer);
    return points_awarded === null ? [] : [{ answer_id: answer.id, points_awarded }];
  });
}

/**
 * Decides live questions (next goal, goal in a period) from the game so far and fills
 * `points_awarded` for every answer that can be scored (rules in @voita_kone/scoring).
 * Idempotent: decided questions and scored answers are never changed again. Runs on API
 * start, after every live sync update, when a game ends, after the Liiga sync and the seed.
 */
export class ScoreAnswersJob {
  constructor(
    private readonly repository: ScoreAnswersRepository,
    private readonly logger: Logger,
  ) {}

  async run(): Promise<ScoreAnswersResult> {
    const questions = await this.repository.list_open_live_questions();
    const game_ids = [...new Set(questions.map((question) => question.game_id))];
    const [games, goals] = await Promise.all([
      this.repository.list_games(game_ids),
      this.repository.list_goals(game_ids),
    ]);
    const decided = decide_questions(questions, games, goals);
    await this.repository.close_questions(decided);

    const updates = score_answers(await this.repository.list_unscored_answers());
    await this.repository.save_points(updates);

    const result = { closed_question_count: decided.length, scored_answer_count: updates.length };
    if (decided.length > 0 || updates.length > 0) {
      this.logger.info(result, "Scored answers");
    }
    return result;
  }
}
