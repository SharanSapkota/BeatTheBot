import { z } from "zod";
import { api_success_schema } from "./api_response";
import { sport_filter_schema } from "./sports";

// Leaderboard: fans vs fans. Only real users are ranked (the AI is a guide, not a player).

export const leaderboard_period_schema = z.enum(["week", "season"]);

/**
 * GET /leaderboard?period=week|season&sport=all|hockey|football|basketball. Accuracy = share of
 * correct winner (outcome) picks in finished games of the period; null without picks
 * (`you_accuracy` also when signed out).
 */
export const leaderboard_schema = z.object({
  period: leaderboard_period_schema,
  sport: sport_filter_schema,
  summary: z.object({
    you_accuracy: z.number().min(0).max(1).nullable(),
    fans_accuracy: z.number().min(0).max(1).nullable(),
    /** Finished games in the period. */
    games_count: z.number().int().min(0),
  }),
  prize: z.object({ title: z.string(), note: z.string() }),
  rows: z.array(
    z.object({
      rank: z.number().int().min(1),
      /** "you" = the signed-in user. */
      kind: z.enum(["user", "you"]),
      display_name: z.string(),
      points: z.number().int(),
      /** Places gained since the last game day; only for the "you" row. */
      movement: z.number().int().nullable(),
    }),
  ),
});

export const leaderboard_response_schema = api_success_schema(leaderboard_schema);

export type LeaderboardPeriod = z.infer<typeof leaderboard_period_schema>;
export type Leaderboard = z.infer<typeof leaderboard_schema>;
export type LeaderboardRow = Leaderboard["rows"][number];
