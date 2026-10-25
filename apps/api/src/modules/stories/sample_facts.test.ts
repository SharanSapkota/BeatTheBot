import {
  build_fact_sheet,
  build_preview_fact_sheet,
  classify_claims,
} from "@voita_kone/fact_checker";
import { describe, expect, it } from "vitest";
import {
  next_games_of,
  played_before,
  sample_preview_input,
  sample_summary_input,
  table_of,
  type LeagueGame,
  type PlayedGame,
} from "./sample_facts";
import { template_preview, template_summary } from "./story_templates";

const TEAMS: Record<string, string> = { a: "AC Oulu", b: "HJK", c: "KuPS" };
/** Every team and player name, as the story job passes them to the checker. */
const KNOWN_NAMES = [
  ...Object.values(TEAMS).map((name) => ({ name, kind: "team" as const })),
  ...["Eetu Ahola", "Leo Rinne", "Aleksi Kangas"].map((name) => ({
    name,
    kind: "player" as const,
  })),
];

function game(
  id: string,
  day: number,
  home: string,
  away: string,
  score: [number, number] | null,
): LeagueGame {
  return {
    id,
    start_time: new Date(Date.UTC(2026, 9, day, 15, 0)),
    status: score ? "final" : "scheduled",
    home_team_id: home,
    away_team_id: away,
    home_team: TEAMS[home] ?? home,
    away_team: TEAMS[away] ?? away,
    home_goals: score?.[0] ?? null,
    away_goals: score?.[1] ?? null,
  };
}

const SEASON: LeagueGame[] = [
  game("g1", 10, "a", "b", [2, 1]),
  game("g2", 12, "b", "c", [1, 1]),
  game("g3", 14, "c", "a", [0, 3]),
  game("g4", 16, "b", "a", [2, 2]),
  game("g5", 20, "a", "b", null),
  game("g6", 23, "c", "b", null),
];
const GOALS = [
  { game_id: "g1", team_id: "a", period: 1, game_time_seconds: 600, player_name: "Eetu Ahola" },
  { game_id: "g3", team_id: "a", period: 2, game_time_seconds: 3000, player_name: "Eetu Ahola" },
  { game_id: "g4", team_id: "a", period: 2, game_time_seconds: 3300, player_name: "Leo Rinne" },
];

describe("table_of (football: 3 / 1 / 0)", () => {
  it("ranks by points, then goal difference", () => {
    const table = table_of(played_before(SEASON, new Date("2026-10-30T00:00:00Z")), "football");
    expect(table.map((row) => [row.team_id, row.points, row.games_played])).toEqual([
      ["a", 7, 3],
      ["b", 2, 3],
      ["c", 1, 2],
    ]);
    expect(table.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it("gives basketball 2 points a win", () => {
    const played = [game("x", 1, "a", "b", [80, 75])] as PlayedGame[];
    expect(table_of(played, "basketball")[0]).toMatchObject({ team_id: "a", points: 2 });
  });
});

describe("sample_preview_input", () => {
  const upcoming = SEASON[4] as LeagueGame;
  const input = sample_preview_input({
    game: upcoming,
    sport: "football",
    season_games: SEASON,
    goals: GOALS,
    meetings: [],
    built_at: new Date("2026-10-19T12:00:00Z"),
  });

  it("counts form with draws, the venue record, the table and the player in form", () => {
    expect(input.home).toMatchObject({
      team: "AC Oulu",
      form: "WWD",
      venue_record: { wins: 1, draws: 0, losses: 0 },
      table: { rank: 1, points: 7, games_played: 3 },
      top_scorer: { player: "Eetu Ahola", goals: 2 },
      stake: null,
    });
    expect(input.away.form).toBe("LDD");
    expect(input.win_chance).toBeNull();
    expect(input.data_source).toBe("sample_data");
  });

  it("counts this season's series from the home team's view", () => {
    expect(input.season_series).toEqual({ home_team_wins: 1, away_team_wins: 0, draws: 1 });
  });

  it("gives a template preview whose every claim is verified", () => {
    const sheet = build_preview_fact_sheet(input);
    const text = template_preview(sheet);
    expect(text).toContain("won 2 and drew 1 of their last 3 games");
    expect(text).toContain("Why it matters: 5 points separate AC Oulu and HJK in the table.");
    const claims = classify_claims(text, sheet, KNOWN_NAMES);
    expect(claims.filter((claim) => claim.status !== "verified")).toEqual([]);
    expect(sheet.facts.every((fact) => fact.source !== "liiga_api")).toBe(true);
  });
});

describe("sample_summary_input", () => {
  const final = SEASON[3] as PlayedGame;
  const input = sample_summary_input({
    game: final,
    sport: "football",
    season_games: SEASON,
    goals: [
      { team_id: "a", period: 1, game_time_seconds: 600, player_name: "Leo Rinne" },
      { team_id: "b", period: 1, game_time_seconds: 1200, player_name: "Aleksi Kangas" },
      { team_id: "b", period: 2, game_time_seconds: 3000, player_name: "Aleksi Kangas" },
      { team_id: "a", period: 2, game_time_seconds: 3300, player_name: "Leo Rinne" },
    ],
    built_at: new Date("2026-10-16T20:00:00Z"),
  });

  it("gives the table before and after the game for both teams", () => {
    expect(input.standings).toEqual([
      { team: "HJK", rank_before: 2, rank_after: 2, points_before: 1, points_after: 2 },
      { team: "AC Oulu", rank_before: 1, rank_after: 1, points_before: 6, points_after: 7 },
    ]);
  });

  it("gives both teams' next games", () => {
    expect(input.next_games).toEqual([
      { team: "HJK", opponent: "AC Oulu", venue: "away", date: "2026-10-20" },
      { team: "AC Oulu", opponent: "HJK", venue: "home", date: "2026-10-20" },
    ]);
  });

  it("writes a draw and a comeback in the template summary, all verified", () => {
    const sheet = build_fact_sheet(input);
    const text = template_summary(sheet);
    expect(text).toContain("HJK and AC Oulu drew 2–2.");
    expect(text).toContain("The lead changed hands 1 time.");
    expect(
      classify_claims(text, sheet, KNOWN_NAMES).filter((claim) => claim.status !== "verified"),
    ).toEqual([]);
  });

  it("has no next game for a team without one", () => {
    const last = game("g9", 25, "c", "a", [1, 0]) as PlayedGame;
    expect(next_games_of([...SEASON, last], last)).toEqual([]);
  });
});
