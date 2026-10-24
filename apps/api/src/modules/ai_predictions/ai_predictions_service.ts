import type { Crowd, DataSays, SeasonOdds, WinChance } from "@voita_kone/shared_types";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import type { GamesRepository } from "../games/games_repository";
import { game_not_found, type GamesService } from "../games/games_service";
import {
  to_data_says,
  to_crowd,
  to_live_model,
  to_season_odds,
  to_win_chance,
} from "./ai_predictions_mapper";
import type { AiPredictionsRepository } from "./ai_predictions_repository";

export function prediction_not_ready(game_id: string): AppError {
  return new AppError(
    "PREDICTION_NOT_READY",
    404,
    `The data for game ${game_id} is not ready yet. It is calculated up to 7 days before puck drop.`,
  );
}

export function game_not_started(game_id: string): AppError {
  return new AppError(
    "GAME_NOT_STARTED",
    409,
    `Game ${game_id} has not started, so there is no live win chance yet.`,
  );
}

/** Reads what the model stored (jobs/run_model.ts). Never calculates on a request. */
export class AiPredictionsService {
  constructor(
    private readonly repository: AiPredictionsRepository,
    private readonly games_repository: GamesRepository,
    private readonly games_service: GamesService,
    private readonly clock: Clock,
  ) {}

  /** The model's win chance and stakes ("Data says"), with the fans' crowd split. */
  async get_data_says(game_id: string): Promise<DataSays> {
    const game = await this.games_repository.find_game(game_id);
    if (!game) {
      throw game_not_found(game_id);
    }
    const row = await this.repository.find_latest_prediction(game_id);
    if (!row) {
      throw prediction_not_ready(game_id);
    }
    const crowd = await this.repository.count_crowd_picks(game_id, game.home_team.id);
    return to_data_says(row, to_crowd(crowd));
  }

  /** How the fans picked the winner, or null before the first pick. */
  async get_crowd(game_id: string): Promise<Crowd | null> {
    const game = await this.games_repository.find_game(game_id);
    if (!game) {
      throw game_not_found(game_id);
    }
    return to_crowd(await this.repository.count_crowd_picks(game_id, game.home_team.id));
  }

  /** Home win chance at puck drop, after every goal and now (live) or at the end (final). */
  async get_win_chance(game_id: string): Promise<WinChance> {
    const game = await this.games_service.get_game_detail(game_id);
    if (game.state === "upcoming") {
      throw game_not_started(game_id);
    }
    const row = await this.repository.find_latest_prediction(game_id);
    if (!row) {
      throw prediction_not_ready(game_id);
    }
    return to_win_chance(game, to_live_model(row), row.model_version, this.clock());
  }

  async get_season_odds(): Promise<SeasonOdds> {
    const rows = await this.repository.find_latest_season_odds();
    if (!rows) {
      throw new AppError(
        "ODDS_NOT_READY",
        404,
        "The season simulation has not run yet. Try again in a moment.",
      );
    }
    return to_season_odds(rows);
  }
}
