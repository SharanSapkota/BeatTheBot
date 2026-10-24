import type { EndedIn } from "@voita_kone/prediction_model";
import type {
  LiigaGame,
  LiigaGoalEvent,
  LiigaPenaltyEvent,
  LiigaPlayer,
  LiigaStandings,
  LiigaTeam,
} from "./liiga_schemas";

// Maps Liiga API responses to our table rows (docs/data_model.md). Rows reference each
// other by external_id; the sync repository resolves them to our uuids.

export type Position = "goalie" | "defense" | "forward";
export type GameStatus = "scheduled" | "live" | "final";

export interface SyncTeam {
  external_id: string;
  name: string;
  short_name: string;
  city: string | null;
  logo_url: string | null;
}

export interface SyncPlayer {
  external_id: string;
  team_external_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  position: Position | null;
  birth_year: number | null;
}

export interface SyncGame {
  external_id: string;
  season: string;
  home_team_external_id: string;
  away_team_external_id: string;
  start_time: Date;
  status: GameStatus;
  home_goals: number | null;
  away_goals: number | null;
  ended_in: EndedIn | null;
  /** Current period while live, last period when final, null before the game. */
  period: number | null;
  /** Seconds since the start of the game, only while live. */
  game_clock_seconds: number | null;
}

export interface SyncGameEvent {
  game_external_id: string;
  event_type: "goal" | "penalty";
  period: number;
  game_time_seconds: number;
  team_external_id: string;
  player_external_id: string | null;
  assist_player_external_ids: string[];
  raw: Record<string, unknown>;
}

export interface SyncStanding {
  team_external_id: string;
  games_played: number;
  points: number;
  goals_for: number;
  goals_against: number;
  rank: number;
}

export interface LiigaSnapshot {
  season: string;
  teams: SyncTeam[];
  players: SyncPlayer[];
  games: SyncGame[];
  events: SyncGameEvent[];
  standings: { taken_at: Date; rows: SyncStanding[] };
  /** Games left out: cancelled, or ended without a known result type. */
  skipped_game_count: number;
}

export interface LiigaResponses {
  season: number;
  teams: readonly LiigaTeam[];
  players: readonly LiigaPlayer[];
  games: readonly LiigaGame[];
  standings: LiigaStandings;
}

// Goal types that are not goals: disallowed after video review, missed penalty shot.
const NOT_A_GOAL_TYPES = new Set(["VT0", "RL0"]);
const MAX_PERIOD = 5;

const POSITION_BY_ROLE: Record<string, Position> = {
  STRIKER: "forward",
  DEFENSEMAN: "defense",
  GOALIE: "goalie",
};

const ENDED_IN_BY_FINISHED_TYPE: Record<string, EndedIn> = {
  ENDED_DURING_REGULAR_GAME_TIME: "regulation",
  ENDED_DURING_EXTENDED_GAME_TIME: "overtime",
  ENDED_DURING_WINNING_SHOT_COMPETITION: "shootout",
};

/** Liiga season id (end year) to our season label: 2027 -> "2026-27". */
export function to_season_label(season: number): string {
  return `${String(season - 1)}-${String(season).slice(-2)}`;
}

/** "JYVÄSKYLÄ" -> "Jyväskylä", "KUOPIO-VEHMASMÄKI" -> "Kuopio-Vehmasmäki". */
export function to_title_case(text: string): string {
  return text
    .toLocaleLowerCase("fi")
    .replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) => {
      return separator + letter.toLocaleUpperCase("fi");
    });
}

function to_player_id(liiga_player_id: number | null | undefined): string | null {
  // Liiga uses 0 for "no player" (e.g. a disallowed goal).
  return liiga_player_id ? String(liiga_player_id) : null;
}

export function map_teams(
  teams: readonly LiigaTeam[],
  games: readonly LiigaGame[],
  standings: LiigaStandings,
): SyncTeam[] {
  // /teams has no full name or city, so take them from games and standings.
  const name_by_team = new Map<string, string>();
  const city_by_team = new Map<string, string>();
  for (const item of standings.items) {
    name_by_team.set(item.teamId, item.teamName);
  }
  for (const game of games) {
    name_by_team.set(game.homeTeam.teamId, game.homeTeam.teamName);
    name_by_team.set(game.awayTeam.teamId, game.awayTeam.teamName);
    const city = game.iceRink?.city;
    if (city && !city_by_team.has(game.homeTeam.teamId)) {
      city_by_team.set(game.homeTeam.teamId, to_title_case(city));
    }
  }

  return teams.map((team) => ({
    external_id: team.id,
    name: name_by_team.get(team.id) ?? team.shortName ?? team.nameAbbreviation,
    short_name: team.nameAbbreviation,
    city: city_by_team.get(team.id) ?? null,
    logo_url: team.logos?.lightBg ?? null,
  }));
}

export function map_player(player: LiigaPlayer): SyncPlayer | null {
  if (!player.teamId) {
    return null;
  }
  const jersey = player.jersey;
  const birth_year = player.dateOfBirth ? Number(player.dateOfBirth.slice(0, 4)) : NaN;
  return {
    external_id: String(player.id),
    team_external_id: player.teamId,
    first_name: player.firstName,
    last_name: player.lastName,
    jersey_number: jersey != null && jersey >= 1 && jersey <= 99 ? jersey : null,
    position: player.role ? (POSITION_BY_ROLE[player.role] ?? null) : null,
    birth_year: Number.isInteger(birth_year) ? birth_year : null,
  };
}

export function map_game(game: LiigaGame): SyncGame | null {
  if (game.finishedType === "CANCELLED") {
    return null;
  }
  const ended_in = game.finishedType
    ? (ENDED_IN_BY_FINISHED_TYPE[game.finishedType] ?? null)
    : null;
  // A final game needs a result type; without one the data is inconsistent, so skip it.
  if (game.ended && !ended_in) {
    return null;
  }
  const status: GameStatus = game.ended ? "final" : game.started ? "live" : "scheduled";
  const has_score = status !== "scheduled";

  return {
    external_id: String(game.id),
    season: to_season_label(game.season),
    home_team_external_id: game.homeTeam.teamId,
    away_team_external_id: game.awayTeam.teamId,
    start_time: new Date(game.start),
    status,
    home_goals: has_score ? (game.homeTeam.goals ?? 0) : null,
    away_goals: has_score ? (game.awayTeam.goals ?? 0) : null,
    ended_in: status === "final" ? ended_in : null,
    period:
      has_score && game.currentPeriod && is_valid_period(game.currentPeriod)
        ? game.currentPeriod
        : null,
    game_clock_seconds:
      status === "live" && game.gameTime != null && game.gameTime >= 0 ? game.gameTime : null,
  };
}

/** Our season label back to the Liiga season id: "2026-27" -> 2027. */
export function to_liiga_season(season_label: string): number {
  return Number(season_label.slice(0, 4)) + 1;
}

function is_real_goal(goal: LiigaGoalEvent): boolean {
  return !(goal.goalTypes ?? []).some((goal_type) => NOT_A_GOAL_TYPES.has(goal_type));
}

function is_valid_period(period: number): boolean {
  return period >= 1 && period <= MAX_PERIOD;
}

function map_goal(
  game_external_id: string,
  team_external_id: string,
  goal: LiigaGoalEvent,
): SyncGameEvent {
  return {
    game_external_id,
    event_type: "goal",
    period: goal.period,
    game_time_seconds: goal.gameTime,
    team_external_id,
    player_external_id: to_player_id(goal.scorerPlayerId),
    assist_player_external_ids: (goal.assistantPlayerIds ?? [])
      .map(to_player_id)
      .filter((id): id is string => id !== null),
    raw: goal,
  };
}

function map_penalty(
  game_external_id: string,
  team_external_id: string,
  penalty: LiigaPenaltyEvent,
): SyncGameEvent {
  return {
    game_external_id,
    event_type: "penalty",
    period: penalty.period,
    game_time_seconds: penalty.gameTime,
    team_external_id,
    player_external_id: to_player_id(penalty.playerId),
    assist_player_external_ids: [],
    raw: penalty,
  };
}

/** Goals and penalties of one game, in game-time order. */
export function map_game_events(game: LiigaGame): SyncGameEvent[] {
  const game_external_id = String(game.id);
  const events = [game.homeTeam, game.awayTeam].flatMap((team) => [
    ...(team.goalEvents ?? [])
      .filter(is_real_goal)
      .map((goal) => map_goal(game_external_id, team.teamId, goal)),
    ...(team.penaltyEvents ?? []).map((penalty) =>
      map_penalty(game_external_id, team.teamId, penalty),
    ),
  ]);
  return events
    .filter((event) => is_valid_period(event.period) && event.game_time_seconds >= 0)
    .sort((first, second) => first.game_time_seconds - second.game_time_seconds);
}

export function map_standings(standings: LiigaStandings): SyncStanding[] {
  return standings.items.map((item) => ({
    team_external_id: item.teamId,
    games_played: item.games,
    points: item.points,
    goals_for: item.goals,
    goals_against: item.goalsAgainst,
    rank: item.ranking,
  }));
}

/**
 * /players lists a player who changed teams once per team. Keep one entry per player:
 * an active one over a removed one, and otherwise the last one in the list.
 */
export function dedupe_players(players: readonly LiigaPlayer[]): LiigaPlayer[] {
  const by_id = new Map<number, LiigaPlayer>();
  for (const player of players) {
    const kept = by_id.get(player.id);
    if (!kept || kept.removed === true || player.removed !== true) {
      by_id.set(player.id, player);
    }
  }
  return [...by_id.values()];
}

/** Maps one full set of Liiga responses. `now` is used when standings have no update time. */
export function map_liiga_responses(responses: LiigaResponses, now: Date): LiigaSnapshot {
  const teams = map_teams(responses.teams, responses.games, responses.standings);
  const team_ids = new Set(teams.map((team) => team.external_id));

  const players = dedupe_players(responses.players)
    .map(map_player)
    .filter((player): player is SyncPlayer => player !== null)
    .filter((player) => team_ids.has(player.team_external_id));

  const kept_games = responses.games.flatMap((game) => {
    const mapped = map_game(game);
    const has_known_teams =
      mapped !== null &&
      team_ids.has(mapped.home_team_external_id) &&
      team_ids.has(mapped.away_team_external_id);
    return mapped && has_known_teams ? [{ game, mapped }] : [];
  });

  const update_date = responses.standings.cacheUpdateDate;
  return {
    season: to_season_label(responses.season),
    teams,
    players,
    games: kept_games.map(({ mapped }) => mapped),
    events: kept_games.flatMap(({ game }) => map_game_events(game)),
    standings: {
      taken_at: update_date ? new Date(update_date) : now,
      rows: map_standings(responses.standings).filter((row) => team_ids.has(row.team_external_id)),
    },
    skipped_game_count: responses.games.length - kept_games.length,
  };
}
