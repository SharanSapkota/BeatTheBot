import { z } from "zod";

// Only the fields we use (see docs/liiga_api/endpoints.md). Unknown fields are dropped,
// except on events, which keep everything so the original can be stored in game_events.raw.

export const liiga_tournament_schema = z.object({
  season: z.number().int(),
});

const liiga_team_schema = z.object({
  id: z.string(),
  nameAbbreviation: z.string(),
  shortName: z.string().nullish(),
  logos: z.object({ lightBg: z.string().nullish() }).nullish(),
});

export const liiga_teams_response_schema = z.object({
  teams: z.array(liiga_team_schema),
});

const liiga_player_schema = z.object({
  id: z.number().int(),
  teamId: z.string().nullish(),
  firstName: z.string(),
  lastName: z.string(),
  jersey: z.number().int().nullish(),
  role: z.string().nullish(),
  dateOfBirth: z.string().nullish(),
  removed: z.boolean().nullish(),
});

export const liiga_players_response_schema = z.object({
  players: z.array(liiga_player_schema),
});

const liiga_goal_event_schema = z.looseObject({
  eventId: z.number().int(),
  scorerPlayerId: z.number().int().nullish(),
  assistantPlayerIds: z.array(z.number().int()).nullish(),
  period: z.number().int(),
  gameTime: z.number().int(),
  goalTypes: z.array(z.string()).nullish(),
});

const liiga_penalty_event_schema = z.looseObject({
  eventId: z.number().int(),
  playerId: z.number().int().nullish(),
  period: z.number().int(),
  gameTime: z.number().int(),
});

const liiga_game_team_schema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  goals: z.number().int().nullish(),
  goalEvents: z.array(liiga_goal_event_schema).nullish(),
  penaltyEvents: z.array(liiga_penalty_event_schema).nullish(),
});

const liiga_game_schema = z.object({
  id: z.number().int(),
  season: z.number().int(),
  start: z.string(),
  started: z.boolean(),
  ended: z.boolean(),
  finishedType: z.string().nullish(),
  currentPeriod: z.number().int().nullish(),
  /** Seconds since the start of the game. */
  gameTime: z.number().int().nullish(),
  homeTeam: liiga_game_team_schema,
  awayTeam: liiga_game_team_schema,
  iceRink: z.object({ city: z.string().nullish() }).nullish(),
});

export const liiga_games_response_schema = z.object({
  games: z.array(liiga_game_schema),
});

/** One game: same events as the bulk call plus penalties. */
export const liiga_game_detail_response_schema = z.object({
  game: liiga_game_schema,
});

const liiga_standings_item_schema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  ranking: z.number().int(),
  games: z.number().int(),
  points: z.number().int(),
  goals: z.number().int(),
  goalsAgainst: z.number().int(),
});

export const liiga_standings_response_schema = z.object({
  items: z.array(liiga_standings_item_schema),
  cacheUpdateDate: z.string().nullish(),
});

export type LiigaTournament = z.infer<typeof liiga_tournament_schema>;
export type LiigaTeam = z.infer<typeof liiga_team_schema>;
export type LiigaPlayer = z.infer<typeof liiga_player_schema>;
export type LiigaGoalEvent = z.infer<typeof liiga_goal_event_schema>;
export type LiigaPenaltyEvent = z.infer<typeof liiga_penalty_event_schema>;
export type LiigaGame = z.infer<typeof liiga_game_schema>;
export type LiigaStandings = z.infer<typeof liiga_standings_response_schema>;
