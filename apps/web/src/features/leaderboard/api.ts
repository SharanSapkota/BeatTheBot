import { useQuery } from "@tanstack/react-query";
import {
  election_leaderboard_response_schema,
  leaderboard_response_schema,
  type ElectionLeaderboard,
  type Leaderboard,
  type LeaderboardPeriod,
  type SportFilter,
} from "@voita_kone/shared_types";
import { api_get } from "../../lib/api_client";
import { useSessionToken } from "../../lib/session";

/**
 * Fans vs fans: you vs all fans and the ranking, for every sport ("all") or one. Signed in, it
 * includes the "You" row.
 */
export function useLeaderboard(period: LeaderboardPeriod, sport: SportFilter = "all") {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["leaderboard", period, sport, token],
    queryFn: async (): Promise<Leaderboard> => {
      const response = await api_get(
        `/leaderboard?period=${period}&sport=${sport}`,
        leaderboard_response_schema,
      );
      return response.data;
    },
  });
}

/** The election leaderboard: separate from games, no prizes. */
export function useElectionLeaderboard() {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["election_leaderboard", token],
    queryFn: async (): Promise<ElectionLeaderboard> => {
      const response = await api_get(
        "/leaderboard/elections",
        election_leaderboard_response_schema,
      );
      return response.data;
    },
  });
}
