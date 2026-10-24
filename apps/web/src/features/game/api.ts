import { useQuery } from "@tanstack/react-query";
import {
  crowd_response_schema,
  data_says_response_schema,
  game_detail_response_schema,
  players_response_schema,
  type Crowd,
  type DataSays,
  type GameSummary,
  type PlayerSummary,
} from "@voita_kone/shared_types";
import { ApiError, api_get } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";

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

/** True for the API's "the model has not calculated this game yet" answer. */
export function is_prediction_not_ready(error: unknown): boolean {
  return error instanceof ApiError && error.code === "PREDICTION_NOT_READY";
}

/**
 * "Data says": the model's win chance and what is at stake (neutral info, never a pick), with
 * the fans' crowd split. Null while it is not calculated yet. In demo mode: the replayed game's
 * numbers from before puck drop.
 */
export function useDataSays(game: GameSummary | undefined) {
  const { is_demo, moment } = useDemoMode();
  return useQuery({
    queryKey: ["data_says", game?.id, is_demo],
    enabled: game !== undefined,
    queryFn: async (): Promise<DataSays | null> => {
      if (!game) {
        throw new Error("game is required");
      }
      const path = is_demo
        ? `/demo/games/${game.id}/data_says?moment=${moment}`
        : `/games/${game.id}/data_says`;
      try {
        return (await api_get(path, data_says_response_schema)).data;
      } catch (error) {
        if (is_prediction_not_ready(error)) {
          return null;
        }
        throw error;
      }
    },
    // The numbers change only when the model runs again (after games end).
    staleTime: 5 * 60_000,
  });
}

/** How the fans picked the winner ("Fans: 62% Kärpät"); null before the first pick. */
export function useCrowd(game_id: string) {
  return useQuery({
    queryKey: ["crowd", game_id],
    queryFn: async (): Promise<Crowd | null> =>
      (await api_get(`/games/${game_id}/crowd`, crowd_response_schema)).data,
    staleTime: 60_000,
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
