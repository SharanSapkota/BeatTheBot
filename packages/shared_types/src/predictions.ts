import { z } from "zod";
import { api_success_schema } from "./api_response";
import { margin_band_schema } from "./sports";

// Before-the-game picks (step 4, per sport in step 8). Locked at puck drop / kick-off.

export const MAX_PICKED_GOALS = 20;

const goals_schema = z.number().int().min(0).max(MAX_PICKED_GOALS);

/**
 * POST and PUT /games/:game_id/predictions. Which fields a sport needs (the API checks it):
 * - hockey: winner (a team), home + away goals, scorer (optional)
 * - football: winner (a team, or null = draw), home + away goals, scorer (optional)
 * - basketball: winner (a team), margin band (optional), top scorer (optional); no goals
 */
export const prediction_request_schema = z.object({
  predicted_winner_team_id: z.uuid().nullable(),
  predicted_home_goals: goals_schema.nullable(),
  predicted_away_goals: goals_schema.nullable(),
  predicted_scorer_id: z.uuid().nullable(),
  predicted_margin_band: margin_band_schema.nullable().default(null),
});

export const user_prediction_schema = prediction_request_schema.extend({
  game_id: z.uuid(),
  /** Null until the game is final and scored. */
  points_awarded: z.number().int().nullable(),
  /** When the pick was first locked in. */
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export const user_prediction_response_schema = api_success_schema(user_prediction_schema);
export const user_predictions_response_schema = api_success_schema(z.array(user_prediction_schema));

export type PredictionRequest = z.infer<typeof prediction_request_schema>;
export type UserPrediction = z.infer<typeof user_prediction_schema>;
