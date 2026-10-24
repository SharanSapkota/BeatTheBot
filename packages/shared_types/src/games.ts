import { z } from "zod";
import { api_success_schema } from "./api_response";

// Games API (roadmap step 2). Times are ISO 8601 UTC; "days" are Europe/Helsinki days.

export const data_source_schema = z.enum(["liiga_api", "demo"]);
export const game_state_schema = z.enum(["upcoming", "live", "final"]);
export const ended_in_schema = z.enum(["regulation", "overtime", "shootout"]);
export const position_schema = z.enum(["goalie", "defense", "forward"]);
export const form_result_schema = z.enum(["W", "OTW", "OTL", "L"]);
export const replay_moment_schema = z.enum(["before", "live", "final"]);
export const local_date_schema = z.iso.date();

export const team_summary_schema = z.object({
  id: z.uuid(),
  external_id: z.string(),
  name: z.string(),
  short_name: z.string(),
  city: z.string().nullable(),
  logo_url: z.string().nullable(),
  data_source: data_source_schema,
});

export const game_summary_schema = z.object({
  id: z.uuid(),
  season: z.string(),
  start_time: z.iso.datetime(),
  state: game_state_schema,
  /** 1-3 regulation, 4 overtime, 5 shootout. Null before the game. */
  period: z.number().int().min(1).max(5).nullable(),
  /** Seconds since the start of the game, only while live. */
  game_clock_seconds: z.number().int().min(0).nullable(),
  home_team: team_summary_schema,
  away_team: team_summary_schema,
  home_goals: z.number().int().min(0).nullable(),
  away_goals: z.number().int().min(0).nullable(),
  ended_in: ended_in_schema.nullable(),
  /** A game of the featured team (Kärpät by default). */
  featured: z.boolean(),
  data_source: data_source_schema,
});

export const player_ref_schema = z.object({
  id: z.uuid(),
  first_name: z.string(),
  last_name: z.string(),
  jersey_number: z.number().int().nullable(),
});

export const score_schema = z.object({
  home: z.number().int().min(0),
  away: z.number().int().min(0),
});

export const game_event_schema = z.object({
  /** Our event id, or "period_end_<n>" for period ends (derived, not stored). */
  id: z.string(),
  event_type: z.enum(["goal", "penalty", "period_end"]),
  period: z.number().int().min(1).max(5),
  game_time_seconds: z.number().int().min(0),
  team_id: z.uuid().nullable(),
  /** Scorer for goals, penalised player for penalties. */
  player: player_ref_schema.nullable(),
  assists: z.array(player_ref_schema),
  penalty_minutes: z.number().int().nullable(),
  /** Running score right after a goal; null for other events. */
  score_after: score_schema.nullable(),
});

export const game_detail_schema = game_summary_schema.extend({
  events: z.array(game_event_schema),
  /** True when the game is a demo replay of a real finished game. */
  demo_replay: z.boolean(),
});

export const game_day_schema = z.object({
  date: local_date_schema,
  /** Live first, then upcoming by start time, then final. Featured first in each group. */
  games: z.array(game_summary_schema),
  demo_replay: z.boolean(),
});

export const player_summary_schema = z.object({
  id: z.uuid(),
  first_name: z.string(),
  last_name: z.string(),
  jersey_number: z.number().int().nullable(),
  position: position_schema.nullable(),
  birth_year: z.number().int().nullable(),
  season_goals: z.number().int().min(0),
  /** Goals in the team's last 5 finished games. */
  goals_last_5: z.number().int().min(0),
});

export const standings_row_schema = z.object({
  rank: z.number().int().min(1),
  team: team_summary_schema,
  games_played: z.number().int().min(0),
  points: z.number().int(),
  goals_for: z.number().int().min(0),
  goals_against: z.number().int().min(0),
  goal_difference: z.number().int(),
  /** Up to 5 latest finished games, newest first. */
  form: z.array(form_result_schema).max(5),
});

export const standings_schema = z.object({
  season: z.string(),
  taken_at: z.iso.datetime().nullable(),
  rows: z.array(standings_row_schema),
});

export const teams_response_schema = api_success_schema(z.array(team_summary_schema));
export const players_response_schema = api_success_schema(z.array(player_summary_schema));
export const games_response_schema = api_success_schema(z.array(game_summary_schema));
export const game_detail_response_schema = api_success_schema(game_detail_schema);
export const game_day_response_schema = api_success_schema(game_day_schema);
export const standings_response_schema = api_success_schema(standings_schema);

export type DataSource = z.infer<typeof data_source_schema>;
export type GameState = z.infer<typeof game_state_schema>;
export type EndedInValue = z.infer<typeof ended_in_schema>;
export type PlayerPosition = z.infer<typeof position_schema>;
export type FormResult = z.infer<typeof form_result_schema>;
export type ReplayMoment = z.infer<typeof replay_moment_schema>;
export type TeamSummary = z.infer<typeof team_summary_schema>;
export type GameSummary = z.infer<typeof game_summary_schema>;
export type PlayerRef = z.infer<typeof player_ref_schema>;
export type Score = z.infer<typeof score_schema>;
export type GameEvent = z.infer<typeof game_event_schema>;
export type GameDetail = z.infer<typeof game_detail_schema>;
export type GameDay = z.infer<typeof game_day_schema>;
export type PlayerSummary = z.infer<typeof player_summary_schema>;
export type StandingsRow = z.infer<typeof standings_row_schema>;
export type Standings = z.infer<typeof standings_schema>;
