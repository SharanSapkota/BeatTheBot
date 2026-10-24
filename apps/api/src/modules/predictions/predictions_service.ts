import {
  margin_band_schema,
  type PredictionRequest,
  type UserPrediction,
} from "@voita_kone/shared_types";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import { game_not_found } from "../games/games_service";
import { to_sport } from "../teams/teams_mapper";
import { pick_rule_error } from "./pick_rules";
import type {
  PickableGameRow,
  PredictionRow,
  PredictionValues,
  PredictionsRepository,
} from "./predictions_repository";

export function to_user_prediction(row: PredictionRow): UserPrediction {
  return {
    game_id: row.game_id,
    predicted_winner_team_id: row.predicted_winner_team_id,
    predicted_home_goals: row.predicted_home_goals,
    predicted_away_goals: row.predicted_away_goals,
    predicted_scorer_id: row.predicted_scorer_id,
    predicted_margin_band: margin_band_schema.nullable().parse(row.predicted_margin_band),
    points_awarded: row.points_awarded,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function invalid_pick(message: string): AppError {
  return new AppError("INVALID_PICK", 400, message);
}

/** Before-the-game picks: one per user and game, editable until puck drop. */
export class PredictionsService {
  constructor(
    private readonly repository: PredictionsRepository,
    private readonly clock: Clock,
  ) {}

  async create(user_id: string, game_id: string, pick: PredictionRequest): Promise<UserPrediction> {
    const values = await this.validated_values(game_id, pick);
    const row = await this.repository.insert_prediction(user_id, game_id, values);
    if (!row) {
      throw new AppError(
        "PREDICTION_EXISTS",
        409,
        `You already have picks for game ${game_id}. Use PUT to change them.`,
      );
    }
    return to_user_prediction(row);
  }

  async update(user_id: string, game_id: string, pick: PredictionRequest): Promise<UserPrediction> {
    const values = await this.validated_values(game_id, pick);
    const row = await this.repository.update_prediction(user_id, game_id, values);
    if (!row) {
      throw new AppError("PREDICTION_NOT_FOUND", 404, `You have no picks for game ${game_id} yet`);
    }
    return to_user_prediction(row);
  }

  async list(user_id: string, game_id: string | undefined): Promise<UserPrediction[]> {
    const rows = await this.repository.list_predictions(user_id, game_id);
    return rows.map(to_user_prediction);
  }

  /**
   * The game must exist and not have started; the pick must fit the sport (pick_rules.ts); the
   * winner and scorer must belong to the game.
   */
  private async validated_values(
    game_id: string,
    pick: PredictionRequest,
  ): Promise<PredictionValues> {
    const game = await this.repository.find_game(game_id);
    if (!game) {
      throw game_not_found(game_id);
    }
    if (this.clock() >= game.start_time) {
      throw new AppError("PREDICTION_LOCKED", 409, `Picks for game ${game_id} locked at puck drop`);
    }
    const rule_error = pick_rule_error(to_sport(game.sport), pick);
    if (rule_error !== null) {
      throw invalid_pick(rule_error);
    }
    if (
      pick.predicted_winner_team_id !== null &&
      !is_team_of(game, pick.predicted_winner_team_id)
    ) {
      throw invalid_pick("The winner must be one of the two teams");
    }
    if (pick.predicted_scorer_id !== null) {
      const team_id = await this.repository.find_player_team_id(pick.predicted_scorer_id);
      if (!team_id || !is_team_of(game, team_id)) {
        throw invalid_pick("The scorer must play for one of the two teams");
      }
    }
    return { ...pick };
  }
}

function is_team_of(game: PickableGameRow, team_id: string): boolean {
  return team_id === game.home_team_id || team_id === game.away_team_id;
}
