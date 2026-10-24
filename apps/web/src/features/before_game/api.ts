import { useQuery } from "@tanstack/react-query";
import {
  user_prediction_response_schema,
  user_predictions_response_schema,
  type GameSummary,
  type PredictionRequest,
  type UserPrediction,
} from "@voita_kone/shared_types";
import { has_pick } from "@voita_kone/scoring";
import { ApiError, api_get, api_request } from "../../lib/api_client";
import { DRAW_PICK, type GamePicks } from "../../lib/picks";
import { useSessionToken } from "../../lib/session";

export function my_prediction_key(game_id: string, token: string | null) {
  return ["my_prediction", game_id, token] as const;
}

/** The user's saved before-game pick for this game (null = none yet). Signed in only. */
export function useMyPrediction(game_id: string, enabled: boolean) {
  const token = useSessionToken();
  return useQuery({
    queryKey: my_prediction_key(game_id, token),
    enabled: enabled && token !== null,
    queryFn: async (): Promise<UserPrediction | null> => {
      const response = await api_get(
        `/me/predictions?game_id=${game_id}`,
        user_predictions_response_schema,
      );
      return response.data[0] ?? null;
    },
  });
}

/** The device's picks in the shape the API takes for the game's sport (a draw = no winner). */
export function to_prediction_request(
  picks: GamePicks,
  winner_team_id: string,
  game: Pick<GameSummary, "sport">,
): PredictionRequest {
  const has_score = has_pick(game.sport, "exact_score");
  return {
    predicted_winner_team_id: winner_team_id === DRAW_PICK ? null : winner_team_id,
    predicted_home_goals: has_score ? picks.home_goals : null,
    predicted_away_goals: has_score ? picks.away_goals : null,
    predicted_scorer_id: picks.scorer_id,
    predicted_margin_band: has_pick(game.sport, "margin_band") ? picks.margin_band : null,
  };
}

/** A pick saved on the server, back in the device's shape. */
export function from_saved_prediction(current: GamePicks, prediction: UserPrediction): GamePicks {
  return {
    ...current,
    winner_team_id: prediction.predicted_winner_team_id ?? DRAW_PICK,
    home_goals: prediction.predicted_home_goals ?? current.home_goals,
    away_goals: prediction.predicted_away_goals ?? current.away_goals,
    scorer_id: prediction.predicted_scorer_id,
    margin_band: prediction.predicted_margin_band,
    locked_at: prediction.updated_at,
  };
}

/**
 * Saves the pick: POST the first time, PUT after. If the server already has a pick (made on
 * another visit), the POST answers 409 PREDICTION_EXISTS and the pick is sent again with PUT.
 */
export async function save_prediction(
  game_id: string,
  request: PredictionRequest,
  has_saved_pick: boolean,
): Promise<UserPrediction> {
  const path = `/games/${game_id}/predictions`;
  if (has_saved_pick) {
    return (await api_request("PUT", path, user_prediction_response_schema, request)).data;
  }
  try {
    return (await api_request("POST", path, user_prediction_response_schema, request)).data;
  } catch (error) {
    if (error instanceof ApiError && error.code === "PREDICTION_EXISTS") {
      return (await api_request("PUT", path, user_prediction_response_schema, request)).data;
    }
    throw error;
  }
}
