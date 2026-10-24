import { beforeAll, describe, expect, it } from "vitest";
import { FixtureLiigaClient } from "./fixture_liiga_client";
import {
  dedupe_players,
  map_game,
  map_game_events,
  map_liiga_responses,
  map_player,
  map_teams,
  to_liiga_season,
  to_season_label,
  to_title_case,
  type LiigaResponses,
} from "./liiga_mapper";
import type { LiigaGame, LiigaPlayer } from "./liiga_schemas";

const SEASON = 2027;
const KARPAT = "495643563:kärpät";
const NOW = new Date("2026-10-24T09:00:00Z");

function build_game(overrides: Partial<LiigaGame> = {}): LiigaGame {
  return {
    id: 1,
    season: SEASON,
    start: "2026-10-24T15:30:00Z",
    started: false,
    ended: false,
    finishedType: "ACTIVE_OR_NOT_STARTED",
    homeTeam: { teamId: "home", teamName: "Home", goals: 0, goalEvents: [], penaltyEvents: [] },
    awayTeam: { teamId: "away", teamName: "Away", goals: 0, goalEvents: [], penaltyEvents: [] },
    iceRink: { city: "OULU" },
    ...overrides,
  };
}

function build_player(overrides: Partial<LiigaPlayer> = {}): LiigaPlayer {
  return {
    id: 100,
    teamId: KARPAT,
    firstName: "Eetu",
    lastName: "Päkkilä",
    jersey: 25,
    role: "STRIKER",
    dateOfBirth: "1997-04-03",
    ...overrides,
  };
}

let responses: LiigaResponses;

beforeAll(async () => {
  const client = new FixtureLiigaClient();
  responses = {
    season: SEASON,
    teams: await client.get_teams(SEASON),
    players: await client.get_players(SEASON),
    games: await client.get_games(SEASON),
    standings: await client.get_standings(SEASON),
  };
});

describe("to_season_label", () => {
  it("turns the Liiga end year into our season label", () => {
    expect(to_season_label(2027)).toBe("2026-27");
    expect(to_season_label(2030)).toBe("2029-30");
    expect(to_liiga_season("2026-27")).toBe(2027);
  });
});

describe("to_title_case", () => {
  it("handles Finnish letters and hyphens", () => {
    expect(to_title_case("JYVÄSKYLÄ")).toBe("Jyväskylä");
    expect(to_title_case("OULU")).toBe("Oulu");
    expect(to_title_case("KUOPIO-VEHMASMÄKI")).toBe("Kuopio-Vehmasmäki");
  });
});

describe("map_teams", () => {
  it("takes the name from games and the city from the home rink", () => {
    const teams = map_teams(responses.teams, responses.games, responses.standings);
    const karpat = teams.find((team) => team.external_id === KARPAT);

    expect(teams).toHaveLength(17);
    expect(karpat).toMatchObject({ name: "Kärpät", city: "Oulu" });
    expect(karpat?.short_name).toBeTruthy();
  });

  it("leaves the city empty for a team without a home game in the data", () => {
    const teams = map_teams(responses.teams, responses.games, responses.standings);
    const hpk = teams.find((team) => team.external_id === "55786244:hpk");

    expect(hpk).toMatchObject({ name: "HPK", city: null });
  });
});

describe("map_player", () => {
  it("maps role, jersey and birth year", () => {
    expect(map_player(build_player())).toEqual({
      external_id: "100",
      team_external_id: KARPAT,
      first_name: "Eetu",
      last_name: "Päkkilä",
      jersey_number: 25,
      position: "forward",
      birth_year: 1997,
    });
    expect(map_player(build_player({ role: "DEFENSEMAN" }))?.position).toBe("defense");
    expect(map_player(build_player({ role: "GOALIE" }))?.position).toBe("goalie");
  });

  it("keeps unknown values empty instead of guessing", () => {
    const player = map_player(build_player({ role: null, jersey: null, dateOfBirth: null }));

    expect(player).toMatchObject({ position: null, jersey_number: null, birth_year: null });
    expect(map_player(build_player({ jersey: 0 }))?.jersey_number).toBeNull();
  });

  it("skips a player without a team", () => {
    expect(map_player(build_player({ teamId: null }))).toBeNull();
  });
});

describe("dedupe_players", () => {
  it("keeps one entry per player who is listed for two teams", () => {
    const old_team = build_player({ teamId: "tappara" });
    const new_team = build_player({ teamId: "kalpa" });

    expect(dedupe_players([old_team, new_team])).toEqual([new_team]);
    expect(dedupe_players([old_team, { ...new_team, removed: true }])).toEqual([old_team]);
    expect(dedupe_players([{ ...old_team, removed: true }, new_team])).toEqual([new_team]);
  });
});

describe("map_game", () => {
  it("maps a game that has not started", () => {
    expect(map_game(build_game())).toMatchObject({
      external_id: "1",
      season: "2026-27",
      status: "scheduled",
      home_goals: null,
      away_goals: null,
      ended_in: null,
    });
  });

  it("maps a live game with the current score", () => {
    const game = build_game({
      started: true,
      currentPeriod: 2,
      gameTime: 1961,
      homeTeam: { teamId: "home", teamName: "Home", goals: 2 },
      awayTeam: { teamId: "away", teamName: "Away", goals: 1 },
    });

    expect(map_game(game)).toMatchObject({
      status: "live",
      home_goals: 2,
      away_goals: 1,
      period: 2,
      game_clock_seconds: 1961,
    });
  });

  it("keeps the last period but no clock for a final game", () => {
    const game = build_game({
      started: true,
      ended: true,
      finishedType: "ENDED_DURING_REGULAR_GAME_TIME",
      currentPeriod: 3,
      gameTime: 3600,
    });

    expect(map_game(game)).toMatchObject({ period: 3, game_clock_seconds: null });
    expect(map_game(build_game({ currentPeriod: 1, gameTime: 0 }))).toMatchObject({
      period: null,
      game_clock_seconds: null,
    });
  });

  it.each([
    ["ENDED_DURING_REGULAR_GAME_TIME", "regulation"],
    ["ENDED_DURING_EXTENDED_GAME_TIME", "overtime"],
    ["ENDED_DURING_WINNING_SHOT_COMPETITION", "shootout"],
  ])("maps %s to ended_in %s", (finished_type, ended_in) => {
    const game = build_game({ started: true, ended: true, finishedType: finished_type });

    expect(map_game(game)).toMatchObject({ status: "final", ended_in });
  });

  it("skips cancelled games and finals without a result type", () => {
    expect(map_game(build_game({ finishedType: "CANCELLED" }))).toBeNull();
    expect(
      map_game(build_game({ started: true, ended: true, finishedType: "ACTIVE_OR_NOT_STARTED" })),
    ).toBeNull();
  });
});

describe("map_game_events", () => {
  it("leaves out disallowed goals and missed penalty shots", () => {
    const game = build_game({
      homeTeam: {
        teamId: "home",
        teamName: "Home",
        goalEvents: [
          { eventId: 1, scorerPlayerId: 0, period: 1, gameTime: 57, goalTypes: ["VT0"] },
          { eventId: 2, scorerPlayerId: 7, period: 1, gameTime: 300, goalTypes: ["RL0"] },
          {
            eventId: 3,
            scorerPlayerId: 9,
            assistantPlayerIds: [10, 0],
            period: 2,
            gameTime: 1512,
            goalTypes: ["YV"],
          },
        ],
      },
    });

    const events = map_game_events(game);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "goal",
      period: 2,
      game_time_seconds: 1512,
      team_external_id: "home",
      player_external_id: "9",
      assist_player_external_ids: ["10"],
    });
    expect(events[0]?.raw).toMatchObject({ eventId: 3, goalTypes: ["YV"] });
  });

  it("maps penalties and sorts events by game time", () => {
    const game = build_game({
      awayTeam: {
        teamId: "away",
        teamName: "Away",
        goalEvents: [{ eventId: 5, scorerPlayerId: 3, period: 3, gameTime: 2500 }],
        penaltyEvents: [{ eventId: 4, playerId: 8, period: 2, gameTime: 1448, penaltyMinutes: 2 }],
      },
    });

    const events = map_game_events(game);

    expect(events.map((event) => event.event_type)).toEqual(["penalty", "goal"]);
    expect(events[0]).toMatchObject({ player_external_id: "8", team_external_id: "away" });
    expect(events[0]?.raw).toMatchObject({ penaltyMinutes: 2 });
  });

  it("matches the final score of every finished fixture game", () => {
    for (const game of responses.games.filter((candidate) => candidate.ended)) {
      const goals = map_game_events(game).filter((event) => event.event_type === "goal");
      const count_for = (team_id: string) =>
        goals.filter((event) => event.team_external_id === team_id).length;

      expect(count_for(game.homeTeam.teamId), `game ${String(game.id)}`).toBe(game.homeTeam.goals);
      expect(count_for(game.awayTeam.teamId), `game ${String(game.id)}`).toBe(game.awayTeam.goals);
    }
  });

  it("keeps the shootout winner as a period 5 goal", () => {
    const shootout_game = responses.games.find((game) => game.id === 2701392);
    const events = shootout_game ? map_game_events(shootout_game) : [];

    expect(events.at(-1)).toMatchObject({ period: 5, game_time_seconds: 3900 });
  });
});

describe("map_liiga_responses", () => {
  it("maps the whole fixture set", () => {
    const snapshot = map_liiga_responses(responses, NOW);

    expect(snapshot.season).toBe("2026-27");
    expect(snapshot.teams).toHaveLength(17);
    expect(snapshot.players).toHaveLength(63);
    expect(snapshot.games).toHaveLength(9);
    expect(snapshot.skipped_game_count).toBe(0);
    expect(snapshot.games.filter((game) => game.status === "final")).toHaveLength(6);
    expect(snapshot.standings.rows).toHaveLength(17);
    expect(snapshot.standings.taken_at).toEqual(new Date("2026-10-24T08:49:49.845Z"));
  });

  it("uses now when the standings have no update time", () => {
    const snapshot = map_liiga_responses(
      { ...responses, standings: { ...responses.standings, cacheUpdateDate: null } },
      NOW,
    );

    expect(snapshot.standings.taken_at).toBe(NOW);
  });

  it("drops players and games of teams that are not in the team list", () => {
    const snapshot = map_liiga_responses(
      {
        ...responses,
        players: [build_player({ teamId: "unknown" })],
        games: [build_game({ homeTeam: { teamId: "unknown", teamName: "?" } })],
      },
      NOW,
    );

    expect(snapshot.players).toHaveLength(0);
    expect(snapshot.games).toHaveLength(0);
    expect(snapshot.skipped_game_count).toBe(1);
  });
});
