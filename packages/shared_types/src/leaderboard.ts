import { z } from "zod";
import { api_success_schema } from "./api_response";

// Leaderboard (step 4): humans vs Kaleva's AI vs all fans.

export const leaderboard_period_schema = z.enum(["week", "season"]);

/**
 * GET /leaderboard?period=week|season (step 4). Accuracy = share of correct winner picks in
 * finished games of the period; null without picks (`you` also when signed out).
 */
export const leaderboard_schema = z.object({
  period: leaderboard_period_schema,
  accuracy: z.object({
    you: z.number().min(0).max(1).nullable(),
    ai: z.number().min(0).max(1).nullable(),
    fans: z.number().min(0).max(1).nullable(),
  }),
  /** Of the last `compared_weeks` full weeks (max 5), weeks where all fans beat the AI. */
  fans_beat_ai_weeks: z.number().int(),
  compared_weeks: z.number().int(),
  /** Finished games in the period with an AI pick. */
  game_count: z.number().int(),
  prize: z.object({ title: z.string(), note: z.string() }),
  rows: z.array(
    z.object({
      rank: z.number().int().min(1),
      /** "you" = the signed-in user; the AI is ranked like a player. */
      kind: z.enum(["user", "ai", "you"]),
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
