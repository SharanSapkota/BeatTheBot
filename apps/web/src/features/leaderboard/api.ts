import { useQuery } from "@tanstack/react-query";
import {
  leaderboard_response_schema,
  user_summary_response_schema,
  type Leaderboard,
  type LeaderboardPeriod,
  type UserSummary,
} from "@voita_kone/shared_types";
import { get_or_sample } from "../../lib/api_client";
import { build_sample_leaderboard, build_sample_user_summary } from "../../mocks/leaderboard";

/** Humans vs AI vs all fans, and the ranking. Sample until step 4. */
export function useLeaderboard(period: LeaderboardPeriod) {
  return useQuery({
    queryKey: ["leaderboard", period],
    queryFn: async (): Promise<Leaderboard> => {
      const response = await get_or_sample(
        `/leaderboard?period=${period}`,
        leaderboard_response_schema,
        "GET /leaderboard",
        () => ({ data: build_sample_leaderboard(period) }),
      );
      return response.data;
    },
  });
}

/** The signed-in user's total points (header pill). Sample until accounts exist (step 4). */
export function useUserSummary() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<UserSummary> => {
      const response = await get_or_sample("/me", user_summary_response_schema, "GET /me", () => ({
        data: build_sample_user_summary(),
      }));
      return response.data;
    },
  });
}
