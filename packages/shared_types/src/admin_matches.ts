import { z } from "zod";
import { api_success_schema } from "./api_response";
import { game_summary_schema, player_ref_schema } from "./games";
import { league_summary_schema } from "./sports";

// /admin → Matches (step 8): football and basketball have no API yet, so an admin adds the
// matches and later the result. Liiga (hockey) games come from the Liiga sync only.

export const MAX_ADMIN_SCORE = 300;
/** Football: a goal's minute, stoppage time and extra time included. */
export const MAX_GOAL_MINUTE = 130;

/** POST / PUT /admin/matches */
export const admin_match_input_schema = z
  .object({
    league_id: z.uuid(),
    home_team_id: z.uuid(),
    away_team_id: z.uuid(),
    start_time: z.iso.datetime(),
  })
  .refine((input) => input.home_team_id !== input.away_team_id, {
    message: "Home and away must be different teams",
    path: ["away_team_id"],
  });

/** One football goal: the scoring team, the scorer (null = not known) and the minute. */
export const admin_goal_input_schema = z.object({
  team_id: z.uuid(),
  player_id: z.uuid().nullable(),
  minute: z.number().int().min(1).max(MAX_GOAL_MINUTE),
});

/**
 * POST /admin/matches/:id/result. Football: `goals` lists every goal (or is empty when the
 * scorers are not known). Basketball: `top_scorer_player_id`; no goals.
 */
export const admin_match_result_input_schema = z.object({
  home_goals: z.number().int().min(0).max(MAX_ADMIN_SCORE),
  away_goals: z.number().int().min(0).max(MAX_ADMIN_SCORE),
  ended_in: z.enum(["regulation", "overtime"]).default("regulation"),
  goals: z.array(admin_goal_input_schema).max(40).default([]),
  top_scorer_player_id: z.uuid().nullable().default(null),
});

export const admin_team_schema = z.object({
  id: z.uuid(),
  name: z.string(),
  short_name: z.string(),
});

/** GET /admin/leagues: the leagues an admin can add matches to, with their teams. */
export const admin_league_schema = league_summary_schema.extend({
  teams: z.array(admin_team_schema),
});

export const admin_match_goal_schema = z.object({
  team_id: z.uuid(),
  player: player_ref_schema.nullable(),
  minute: z.number().int().min(0),
});

/** GET /admin/matches: a match with its pick count and the entered result. */
export const admin_match_schema = game_summary_schema.extend({
  pick_count: z.number().int().min(0),
  goals: z.array(admin_match_goal_schema),
  top_scorer: player_ref_schema.nullable(),
});

export const admin_leagues_response_schema = api_success_schema(z.array(admin_league_schema));
export const admin_matches_response_schema = api_success_schema(z.array(admin_match_schema));
export const admin_match_response_schema = api_success_schema(admin_match_schema);

export type AdminMatchInput = z.infer<typeof admin_match_input_schema>;
export type AdminGoalInput = z.infer<typeof admin_goal_input_schema>;
export type AdminMatchResultInput = z.infer<typeof admin_match_result_input_schema>;
export type AdminMatchResultRequest = z.input<typeof admin_match_result_input_schema>;
export type AdminTeam = z.infer<typeof admin_team_schema>;
export type AdminLeague = z.infer<typeof admin_league_schema>;
export type AdminMatchGoal = z.infer<typeof admin_match_goal_schema>;
export type AdminMatch = z.infer<typeof admin_match_schema>;
