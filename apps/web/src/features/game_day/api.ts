import { useQuery } from "@tanstack/react-query";
import {
  game_day_response_schema,
  sports_day_response_schema,
  type GameDay,
  type Sport,
  type SportsDay,
} from "@voita_kone/shared_types";
import { api_get } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";

const LIVE_REFETCH_MS = 15_000;

/** One sport's games today (Helsinki day). In demo mode: its replayed day at the chosen moment. */
export function useGameDay(sport: Sport) {
  const { is_demo, moment } = useDemoMode();
  const path = is_demo
    ? `/demo/game_day?moment=${moment}&sport=${sport}`
    : `/game_days/today?sport=${sport}`;
  return useQuery({
    queryKey: ["game_day", sport, is_demo ? moment : "today"],
    queryFn: async (): Promise<GameDay> => (await api_get(path, game_day_response_schema)).data,
    refetchInterval: (query) =>
      query.state.data?.games.some((game) => game.state === "live") ? LIVE_REFETCH_MS : false,
  });
}

/** The sport tabs: every sport with today's game count (demo mode: the replay days). */
export function useSports() {
  const { is_demo } = useDemoMode();
  return useQuery({
    queryKey: ["sports", is_demo],
    queryFn: async (): Promise<SportsDay> =>
      (await api_get(is_demo ? "/demo/sports" : "/sports", sports_day_response_schema)).data,
    staleTime: 60_000,
  });
}
