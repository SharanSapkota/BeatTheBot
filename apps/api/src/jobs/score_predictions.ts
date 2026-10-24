import {
  outcome_key,
  score_pre_game,
  type CrowdSplit,
  type GameResult,
  type PreGamePick,
  type SportId,
} from "@voita_kone/scoring";
import type { Clock } from "../common/clock";
import type { Logger } from "../common/logger";
import type {
  CrowdRow,
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
    top_scorer_id: game.top_scorer_id,
  };
}

export function to_crowd_split(game_id: string, rows: readonly CrowdRow[]): CrowdSplit {
  const mine = rows.filter((row) => row.game_id === game_id);
  return {
    total_picks: mine.reduce((total, row) => total + row.pick_count, 0),
    picks_by_team: Object.fromEntries(
      mine.map((row) => [outcome_key(row.winner_team_id), row.pick_count]),
    ),
  };
}

function to_pick(row: UnscoredPrediction): PreGamePick {
  return {
    winner_team_id: row.winner_team_id,
    home_goals: row.home_goals,
    away_goals: row.away_goals,
    scorer_id: row.scorer_id,
    margin_band: row.margin_band,
  };
}

/** Points for every pick to score in one finished game (rules in @voita_kone/scoring). */
export function score_game(
  sport: SportId,
  result: GameResult,
  crowd: CrowdSplit,
  predictions: readonly UnscoredPrediction[],
): ScoreUpdate[] {
  return predictions.map((prediction) => ({
    prediction_id: prediction.id,
    points_awarded: score_pre_game(sport, to_pick(prediction), result, crowd).total,
  }));
}

/**
 * Fills `points_awarded` for before-game picks of finished games. Idempotent: only picks
 * without `scored_at`, or scored with older rules (`scoring_version`), are scored. Runs on API
 * start, when live sync sees a final, after the Liiga sync and after seeding.
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
    const [goals, crowd, predictions] = await Promise.all([
      this.repository.list_goals(game_ids),
      this.repository.list_crowd(game_ids),
      this.repository.list_unscored_predictions(game_ids),
    ]);

    const updates = games.flatMap((game) =>
      score_game(
        game.sport,
        to_game_result(game, goals),
        to_crowd_split(game.id, crowd),
        predictions.filter((prediction) => prediction.game_id === game.id),
      ),
    );
    await this.repository.save_points(updates, this.clock());

    const result = { scored_game_count: games.length, scored_prediction_count: updates.length };
    this.logger.info(result, "Scored before-game picks");
    return result;
  }
}
