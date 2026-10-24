import { score_pre_game, type GameResult, type PreGamePick } from "@voita_kone/scoring";
import type { Clock } from "../common/clock";
import type { Logger } from "../common/logger";
import type {
  AiPickRow,
  GoalRow,
  ScorableGame,
  ScorePredictionsRepository,
  ScoreUpdate,
  UnscoredPrediction,
} from "./score_predictions_repository";

export interface ScorePredictionsResult {
  scored_game_count: number;
  scored_prediction_count: number;
}

export function to_game_result(game: ScorableGame, goals: readonly GoalRow[]): GameResult {
  return {
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    home_goals: game.home_goals,
    away_goals: game.away_goals,
    ended_in: game.ended_in,
    goals: goals.filter((goal) => goal.game_id === game.id),
  };
}

function to_pick(row: AiPickRow | UnscoredPrediction): PreGamePick {
  return {
    winner_team_id: row.winner_team_id,
    home_goals: row.home_goals,
    away_goals: row.away_goals,
    scorer_id: row.scorer_id,
  };
}

/** Points for every unscored pick of one finished game (rules in @voita_kone/scoring). */
export function score_game(
  result: GameResult,
  ai_pick: AiPickRow | undefined,
  predictions: readonly UnscoredPrediction[],
): ScoreUpdate[] {
  const ai = ai_pick ? to_pick(ai_pick) : null;
  return predictions.map((prediction) => ({
    prediction_id: prediction.id,
    points_awarded: score_pre_game(to_pick(prediction), result, ai).total,
  }));
}

/**
 * Fills `points_awarded` for before-game picks of finished games. Idempotent: only picks
 * without `scored_at` are scored. Runs when live sync sees a final, after the Liiga sync
 * and after seeding.
 */
export class ScorePredictionsJob {
  constructor(
    private readonly repository: ScorePredictionsRepository,
    private readonly logger: Logger,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<ScorePredictionsResult> {
    const games = await this.repository.find_games_to_score();
    if (games.length === 0) {
      return { scored_game_count: 0, scored_prediction_count: 0 };
    }
    const game_ids = games.map((game) => game.id);
    const [goals, ai_picks, predictions] = await Promise.all([
      this.repository.list_goals(game_ids),
      this.repository.list_ai_picks(game_ids),
      this.repository.list_unscored_predictions(game_ids),
    ]);

    const updates = games.flatMap((game) =>
      score_game(
        to_game_result(game, goals),
        ai_picks.find((pick) => pick.game_id === game.id),
        predictions.filter((prediction) => prediction.game_id === game.id),
      ),
    );
    await this.repository.save_points(updates, this.clock());

    const result = { scored_game_count: games.length, scored_prediction_count: updates.length };
    this.logger.info(result, "Scored before-game picks");
    return result;
  }
}
