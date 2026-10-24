import type { EventRow, GameRow, PlayerRefRow } from "../modules/games/games_repository";
import type { TeamRow } from "../modules/teams/teams_mapper";
import { LIIGA_LEAGUE_ID } from "../db/leagues";

// Builders for unit tests with fake repositories. Ids are valid v4 uuids.

export const HOME_TEAM: TeamRow = {
  id: "11111111-1111-4111-8111-111111111111",
  external_id: "495643563:kärpät",
  name: "Kärpät",
  short_name: "KÄR",
  city: "Oulu",
  logo_url: null,
  sport: "hockey",
  data_source: "liiga_api",
};

export const AWAY_TEAM: TeamRow = {
  id: "22222222-2222-4222-8222-222222222222",
  external_id: "859884935:kalpa",
  name: "KalPa",
  short_name: "KAL",
  city: "Kuopio",
  logo_url: null,
  sport: "hockey",
  data_source: "liiga_api",
};

export function build_team_row(index: number, name: string): TeamRow {
  const digit = String(index % 10);
  return {
    id: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`,
    external_id: `${String(index)}:${name.toLowerCase()}`,
    name,
    short_name: name.slice(0, 3).toUpperCase(),
    city: null,
    logo_url: null,
    sport: "hockey",
    data_source: "liiga_api",
  };
}

export function build_game_row(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    external_id: "2701405",
    sport: "hockey",
    league: { id: LIIGA_LEAGUE_ID, name: "Liiga" },
    season: "2026-27",
    start_time: new Date("2026-10-23T15:30:00Z"),
    status: "final",
    period: 3,
    game_clock_seconds: null,
    home_goals: 2,
    away_goals: 1,
    ended_in: "regulation",
    data_source: "liiga_api",
    home_team: HOME_TEAM,
    away_team: AWAY_TEAM,
    top_scorer: null,
    ...overrides,
  };
}

export function build_player_ref(index: number, last_name: string): PlayerRefRow {
  const digit = String(index % 10);
  return {
    id: `${digit.repeat(8)}-0000-4000-8000-${digit.repeat(12)}`,
    first_name: "Test",
    last_name,
    jersey_number: index,
  };
}

let event_counter = 0;

export function build_goal(
  team: TeamRow,
  period: number,
  game_time_seconds: number,
  scorer: PlayerRefRow | null = null,
  assists: PlayerRefRow[] = [],
): EventRow {
  event_counter += 1;
  return {
    id: `eeeeeeee-eeee-4eee-8eee-${String(event_counter).padStart(12, "0")}`,
    event_type: "goal",
    period,
    game_time_seconds,
    team_id: team.id,
    player: scorer,
    assists,
    penalty_minutes: null,
  };
}

export function build_penalty(
  team: TeamRow,
  period: number,
  game_time_seconds: number,
  minutes = 2,
): EventRow {
  return {
    ...build_goal(team, period, game_time_seconds),
    event_type: "penalty",
    penalty_minutes: minutes,
  };
}
