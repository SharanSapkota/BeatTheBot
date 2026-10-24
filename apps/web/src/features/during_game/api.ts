import { useQuery } from "@tanstack/react-query";
import {
  win_chance_response_schema,
  type AiPrediction,
  type GameDetail,
  type WinChance,
} from "@voita_kone/shared_types";
import { get_or_sample } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";
import { build_sample_win_chance } from "../../mocks/win_chance";

function goal_count(game: GameDetail): number {
  return game.events.filter((event) => event.event_type === "goal").length;
}

/**
 * The AI's live home win chance: puck drop, after every goal and now (live), or the whole
 * game (final). Demo mode uses the replay moment. Sample data only if the endpoint fails.
 */
export function useWinChance(game: GameDetail, prediction: AiPrediction | null | undefined) {
  const { is_demo, moment } = useDemoMode();
  return useQuery({
    queryKey: ["win_chance", game.id, goal_count(game), game.game_clock_seconds, is_demo && moment],
    enabled: Boolean(prediction) && game.state !== "upcoming",
    queryFn: async (): Promise<WinChance> => {
      if (!prediction) {
        throw new Error("prediction is required");
      }
      const path = is_demo
        ? `/demo/games/${game.id}/win_chance?moment=${moment}`
        : `/games/${game.id}/win_chance`;
      const response = await get_or_sample(
        path,
        win_chance_response_schema,
        "GET /games/:game_id/win_chance",
        () => ({ data: build_sample_win_chance(game, prediction) }),
      );
      return response.data;
    },
  });
}
