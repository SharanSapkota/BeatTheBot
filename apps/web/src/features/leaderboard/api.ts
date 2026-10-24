import { useQuery } from "@tanstack/react-query";
import {
  leaderboard_response_schema,
  type Leaderboard,
  type LeaderboardPeriod,
} from "@voita_kone/shared_types";
import { api_get } from "../../lib/api_client";
import { useSessionToken } from "../../lib/session";

/** Humans vs AI vs all fans, and the ranking. Signed in, it includes the "You" row. */
export function useLeaderboard(period: LeaderboardPeriod) {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["leaderboard", period, token],
    queryFn: async (): Promise<Leaderboard> => {
      const response = await api_get(`/leaderboard?period=${period}`, leaderboard_response_schema);
      return response.data;
    },
  });
}
