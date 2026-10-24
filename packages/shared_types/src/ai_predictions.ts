import { z } from "zod";
import { api_success_schema } from "./api_response";
import { game_state_schema, team_summary_schema } from "./games";

// AI prediction API (roadmap step 3). Every number comes from packages/prediction_model;
// reasons are facts with a template sentence, never free LLM text.

export const stake_kind_schema = z.enum(["relegation", "top_4", "playoffs"]);

/** One fact behind the AI's pick, e.g. "Kärpät won 4 of their last 5 home games." */
export const ai_reason_schema = z.object({
  fact_id: z.string(),
  type: z.string(),
  values: z.record(z.string(), z.union([z.number(), z.string()])),
  text_en: z.string(),
});

export const predicted_scorer_schema = z.object({
  id: z.uuid(),
  team_id: z.uuid(),
  first_name: z.string(),
  last_name: z.string(),
  jersey_number: z.number().int().nullable(),
  /** Goals in the team's last `recent_games` games. */
  recent_goals: z.number().int().min(0),
  recent_games: z.number().int().min(0),
  season_goals: z.number().int().min(0),
});

/** The team's playoff / top-4 / relegation probability if it wins vs loses this game. */
export const stake_schema = z.object({
  team_id: z.uuid(),
  kind: stake_kind_schema,
  if_win: z.number().min(0).max(1),
  if_loss: z.number().min(0).max(1),
});

/** How the fans have picked (user predictions). Null until someone has picked. */
export const crowd_schema = z.object({
  home_pick_share: z.number().min(0).max(1),
  total_picks: z.number().int().min(1),
});

/** GET /games/:game_id/ai_prediction (and the demo replay version). */
export const ai_prediction_schema = z.object({
  game_id: z.uuid(),
  predicted_winner_team_id: z.uuid(),
  /** Win probabilities including overtime and shootout; they add up to 1. */
  home_win_probability: z.number().min(0).max(1),
  away_win_probability: z.number().min(0).max(1),
  /** Chance the game is tied after 60 minutes. */
  overtime_probability: z.number().min(0).max(1),
  /** The most likely 60-minute score in which the predicted winner wins. */
  predicted_home_goals: z.number().int().min(0),
  predicted_away_goals: z.number().int().min(0),
  predicted_scorer: predicted_scorer_schema.nullable(),
  /** Up to 3, most relevant first. */
  reasons: z.array(ai_reason_schema).max(3),
  /** The most interesting stake per team, biggest change first. */
  stakes: z.array(stake_schema),
  crowd: crowd_schema.nullable(),
  label_text: z.string(),
  model_version: z.string(),
  calculated_at: z.iso.datetime(),
});

export const win_chance_point_schema = z.object({
  /** start = puck drop, goal = right after a goal, now = live, end = final result. */
  kind: z.enum(["start", "goal", "now", "end"]),
  game_time_seconds: z.number().int().min(0),
  home_goals: z.number().int().min(0),
  away_goals: z.number().int().min(0),
  home_win_probability: z.number().min(0).max(1),
});

/** GET /games/:game_id/win_chance: the home win chance over the game (live or final). */
export const win_chance_schema = z.object({
  game_id: z.uuid(),
  state: game_state_schema,
  points: z.array(win_chance_point_schema).min(1),
  model_version: z.string(),
  updated_at: z.iso.datetime(),
});

export const season_odds_row_schema = z.object({
  team: team_summary_schema,
  playoff_probability: z.number().min(0).max(1),
  top_4_probability: z.number().min(0).max(1),
  relegation_probability: z.number().min(0).max(1),
  expected_points: z.number(),
});

/** GET /standings/odds: season simulation, most likely to make the playoffs first. */
export const season_odds_schema = z.object({
  season: z.string(),
  model_version: z.string(),
  simulations: z.number().int().min(1),
  calculated_at: z.iso.datetime(),
  rows: z.array(season_odds_row_schema),
});

export const ai_prediction_response_schema = api_success_schema(ai_prediction_schema);
export const win_chance_response_schema = api_success_schema(win_chance_schema);
export const season_odds_response_schema = api_success_schema(season_odds_schema);

export type StakeKind = z.infer<typeof stake_kind_schema>;
export type AiReason = z.infer<typeof ai_reason_schema>;
export type PredictedScorer = z.infer<typeof predicted_scorer_schema>;
export type Stake = z.infer<typeof stake_schema>;
export type Crowd = z.infer<typeof crowd_schema>;
export type AiPrediction = z.infer<typeof ai_prediction_schema>;
export type WinChancePoint = z.infer<typeof win_chance_point_schema>;
export type WinChance = z.infer<typeof win_chance_schema>;
export type SeasonOddsRow = z.infer<typeof season_odds_row_schema>;
export type SeasonOdds = z.infer<typeof season_odds_schema>;
