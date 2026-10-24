import type {
  GameDetail,
  GameEvent,
  GameState,
  PlayerSummary,
  TeamSummary,
} from "@voita_kone/shared_types";

// The design's game, Kärpät 3-1 Ilves, as the API returns it. Ids are valid v4 uuids.

export const KARPAT: TeamSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  external_id: "495643563:kärpät",
  name: "Kärpät",
  short_name: "KÄRPÄT",
  city: "Oulu",
  logo_url: null,
  data_source: "liiga_api",
};

export const ILVES: TeamSummary = {
  id: "22222222-2222-4222-8222-222222222222",
  external_id: "1:ilves",
  name: "Ilves",
  short_name: "ILVES",
  city: "Tampere",
  logo_url: null,
  data_source: "liiga_api",
};

export const LAINE = {
  id: "aaaaaaaa-0000-4000-8000-000000000019",
  first_name: "Eetu",
  last_name: "Laine",
  jersey_number: 19,
};
export const NIEMI = {
  id: "aaaaaaaa-0000-4000-8000-000000000027",
  first_name: "Joonas",
  last_name: "Niemi",
  jersey_number: 27,
};
export const MAKELA = {
  id: "bbbbbbbb-0000-4000-8000-000000000011",
  first_name: "Aleksi",
  last_name: "Mäkelä",
  jersey_number: 11,
};

function goal(
  index: number,
  team: TeamSummary,
  period: number,
  time: number,
  player: typeof LAINE,
  home: number,
  away: number,
): GameEvent {
  return {
    id: `eeeeeeee-0000-4000-8000-00000000000${String(index)}`,
    event_type: "goal",
    period,
    game_time_seconds: time,
    team_id: team.id,
    player,
    assists: [],
    penalty_minutes: null,
    score_after: { home, away },
  };
}

/** Goals of the design game: Laine 14:37, Mäkelä 25:12, Niemi 33:50, Laine 51:03. */
export const DESIGN_GOALS: GameEvent[] = [
  goal(1, KARPAT, 1, 877, LAINE, 1, 0),
  goal(2, ILVES, 2, 1512, MAKELA, 1, 1),
  goal(3, KARPAT, 2, 2030, NIEMI, 2, 1),
  goal(4, KARPAT, 3, 3063, LAINE, 3, 1),
];

export function build_game(state: GameState, overrides: Partial<GameDetail> = {}): GameDetail {
  const is_final = state === "final";
  const is_live = state === "live";
  const events = is_final ? DESIGN_GOALS : is_live ? DESIGN_GOALS.slice(0, 2) : [];
  return {
    id: "99999999-9999-4999-8999-999999999999",
    season: "2026-27",
    start_time: is_final || is_live ? "2026-10-24T15:30:00.000Z" : "2099-10-24T15:30:00.000Z",
    state,
    period: is_final ? 3 : is_live ? 2 : null,
    game_clock_seconds: is_live ? 1961 : null,
    home_team: KARPAT,
    away_team: ILVES,
    home_goals: is_final ? 3 : is_live ? 1 : null,
    away_goals: is_final ? 1 : is_live ? 1 : null,
    ended_in: is_final ? "regulation" : null,
    featured: true,
    data_source: "liiga_api",
    events,
    demo_replay: false,
    ...overrides,
  };
}

export function build_player(
  player: typeof LAINE,
  goals_last_5: number,
  season_goals: number,
): PlayerSummary {
  return { ...player, position: "forward", birth_year: 2000, season_goals, goals_last_5 };
}
