import { useQuery } from "@tanstack/react-query";
import {
  ai_prediction_response_schema,
  game_detail_response_schema,
  players_response_schema,
  type AiPrediction,
  type GameSummary,
  type PlayerSummary,
} from "@voita_kone/shared_types";
import { api_get, get_or_sample } from "../../lib/api_client";
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

/** The AI's pre-game pick. Sample data until the prediction model exists (step 3). */
export function useAiPrediction(game: GameSummary | undefined) {
  return useQuery({
    queryKey: ["ai_prediction", game?.id],
    enabled: game !== undefined,
    queryFn: async (): Promise<AiPrediction> => {
      if (!game) {
        throw new Error("game is required");
      }
      const response = await get_or_sample(
        `/games/${game.id}/ai_prediction`,
        ai_prediction_response_schema,
        "GET /games/:game_id/ai_prediction",
        async () => ({ data: await build_sample_ai_prediction(game) }),
      );
      return response.data;
    },
    staleTime: Infinity,
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

export function to_ai_pick(prediction: AiPrediction | undefined): AiPick | null {
  if (!prediction) {
    return null;
  }
  return {
    winner_team_id: prediction.predicted_winner_team_id,
    home_goals: prediction.predicted_home_goals,
    away_goals: prediction.predicted_away_goals,
    scorer_id: prediction.predicted_scorer_id,
  };
}
