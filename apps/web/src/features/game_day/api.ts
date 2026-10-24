import { useQuery } from "@tanstack/react-query";
import { game_day_response_schema, type GameDay } from "@voita_kone/shared_types";
import { api_get } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";

const LIVE_REFETCH_MS = 15_000;

/** Today's games (Helsinki day). In demo mode: the replayed day at the chosen moment. */
export function useGameDay() {
  const { is_demo, moment } = useDemoMode();
  const path = is_demo ? `/demo/game_day?moment=${moment}` : "/game_days/today";
  return useQuery({
    queryKey: ["game_day", is_demo ? moment : "today"],
    queryFn: async (): Promise<GameDay> => (await api_get(path, game_day_response_schema)).data,
    refetchInterval: (query) =>
      query.state.data?.games.some((game) => game.state === "live") ? LIVE_REFETCH_MS : false,
  });
}
