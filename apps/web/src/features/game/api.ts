import { useQuery } from "@tanstack/react-query";
import {
  ai_prediction_response_schema,
  game_detail_response_schema,
  players_response_schema,
  type AiPrediction,
  type GameSummary,
  type PlayerSummary,
} from "@voita_kone/shared_types";
import { ApiError, api_get, get_or_sample } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";
import type { AiPick } from "../../lib/points";
import { build_sample_ai_prediction } from "../../mocks/ai_prediction";

const LIVE_REFETCH_MS = 15_000;

/** One game in detail. In demo mode it is the replay at the chosen moment. */
export function useGameDetail(game_id: string) {
  const { is_demo, moment } = useDemoMode();
  const path = is_demo ? `/demo/games/${game_id}?moment=${moment}` : `/games/${game_id}`;
  return useQuery({
    queryKey: ["game", game_id, is_demo ? moment : "real"],
    queryFn: async () => (await api_get(path, game_detail_response_schema)).data,
    // Live games refresh every 15 s; refetching stops once the game is final.
    refetchInterval: (query) => (query.state.data?.state === "live" ? LIVE_REFETCH_MS : false),
  });
}

/** True for the API's "the model has not predicted this game yet" answer. */
export function is_prediction_not_ready(error: unknown): boolean {
  return error instanceof ApiError && error.code === "PREDICTION_NOT_READY";
}

/**
 * The AI's pre-game pick from the prediction model; null while it is not calculated yet.
 * In demo mode: the real pre-game pick of the replayed game. Sample data only if the
 * endpoint fails.
 */
export function useAiPrediction(game: GameSummary | undefined) {
  const { is_demo, moment } = useDemoMode();
  return useQuery({
    queryKey: ["ai_prediction", game?.id, is_demo],
    enabled: game !== undefined,
    queryFn: async (): Promise<AiPrediction | null> => {
      if (!game) {
        throw new Error("game is required");
      }
      const path = is_demo
        ? `/demo/games/${game.id}/ai_prediction?moment=${moment}`
        : `/games/${game.id}/ai_prediction`;
      try {
        const response = await get_or_sample(
          path,
          ai_prediction_response_schema,
          "GET /games/:game_id/ai_prediction",
          async () => ({ data: await build_sample_ai_prediction(game) }),
        );
        return response.data;
      } catch (error) {
        if (is_prediction_not_ready(error)) {
          return null;
        }
        throw error;
      }
    },
    // The pick changes only when the model runs again (after games end).
    staleTime: 5 * 60_000,
  });
}

export function useTeamPlayers(team_id: string | undefined) {
  return useQuery({
    queryKey: ["players", team_id],
    enabled: team_id !== undefined,
    queryFn: async (): Promise<PlayerSummary[]> =>
      (await api_get(`/teams/${team_id ?? ""}/players`, players_response_schema)).data,
    staleTime: 5 * 60_000,
  });
}

export function to_ai_pick(prediction: AiPrediction | null | undefined): AiPick | null {
  if (!prediction) {
    return null;
  }
  return {
    winner_team_id: prediction.predicted_winner_team_id,
    home_goals: prediction.predicted_home_goals,
    away_goals: prediction.predicted_away_goals,
    scorer_id: prediction.predicted_scorer?.id ?? null,
  };
}
