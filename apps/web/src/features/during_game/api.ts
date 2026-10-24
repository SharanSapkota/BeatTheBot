import { useQuery } from "@tanstack/react-query";
import {
  fan_poll_response_schema,
  win_chance_response_schema,
  type AiPrediction,
  type FanPoll,
  type GameDetail,
  type WinChance,
} from "@voita_kone/shared_types";
import { get_or_sample } from "../../lib/api_client";
import { build_sample_fan_poll } from "../../mocks/fan_poll";
import { build_sample_win_chance } from "../../mocks/win_chance";

function goal_count(game: GameDetail): number {
  return game.events.filter((event) => event.event_type === "goal").length;
}

/** Live AI win chance, updated after each goal. Sample until step 3. */
export function useWinChance(game: GameDetail, prediction: AiPrediction | undefined) {
  return useQuery({
    queryKey: ["win_chance", game.id, goal_count(game)],
    enabled: prediction !== undefined,
    queryFn: async (): Promise<WinChance> => {
      if (!prediction) {
        throw new Error("prediction is required");
      }
      const response = await get_or_sample(
        `/games/${game.id}/win_chance`,
        win_chance_response_schema,
        "GET /games/:game_id/win_chance",
        () => ({ data: build_sample_win_chance(game, prediction) }),
      );
      return response.data;
    },
  });
}

/** Fan poll: best player so far (no points). Sample until step 6. */
export function useFanPoll(game: GameDetail) {
  return useQuery({
    queryKey: ["fan_poll", game.id, goal_count(game)],
    queryFn: async (): Promise<FanPoll> => {
      const response = await get_or_sample(
        `/games/${game.id}/questions?phase=live`,
        fan_poll_response_schema,
        "GET /games/:game_id/questions?phase=live",
        () => ({ data: build_sample_fan_poll(game) }),
      );
      return response.data;
    },
  });
}
