import { describe, expect, it } from "vitest";
import { to_season_data } from "../ai_predictions/model_inputs";
import type { ModelGameRow } from "../ai_predictions/model_inputs_repository";
import { compute_season_facts, known_names_of, type StoryGame } from "./fact_sheet_input";

const TEAMS = [
  { id: "a", name: "Kärpät" },
  { id: "b", name: "Ilves" },
  { id: "c", name: "Tappara" },
  { id: "d", name: "Jukurit" },
];

function game(
  id: string,
  start_iso: string,
  home: string,
  away: string,
  score: [number, number] | null,
): ModelGameRow {
  return {
    id,
    season: "2026-27",
    home_team_id: home,
    away_team_id: away,
    start_time: new Date(start_iso),
    status: score ? "final" : "scheduled",
    home_goals: score?.[0] ?? null,
    away_goals: score?.[1] ?? null,
    ended_in: score ? "regulation" : null,
  };
}

// Day 1: Tappara 2–0 Jukurit. Day 2 at 18:30 (one time slot): Kärpät 3–1 Ilves (the story's
// game) and Tappara 4–0 Jukurit. Day 3: Kärpät host Jukurit.
const DATA = to_season_data({
  season: "2026-27",
  teams: TEAMS,
  games: [
    game("g1", "2026-10-20T15:30:00Z", "c", "d", [2, 0]),
    game("g2", "2026-10-22T15:30:00Z", "a", "b", [3, 1]),
    game("g3", "2026-10-22T15:30:00Z", "c", "d", [4, 0]),
    game("g4", "2026-10-25T13:00:00Z", "a", "d", null),
  ],
  players: [
    {
      id: "p1",
      team_id: "a",
      first_name: "Eetu",
      last_name: "Laine",
      jersey_number: 19,
      position: "forward",
    },
  ],
  goals: [],
});

const STORY_GAME: StoryGame = {
  id: "g2",
  start_time: new Date("2026-10-22T15:30:00Z"),
  home_team_id: "a",
  away_team_id: "b",
  home_team: "Kärpät",
  away_team: "Ilves",
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
};

describe("compute_season_facts", () => {
  const facts = compute_season_facts(DATA, STORY_GAME, 200);

  it("ranks the table after the whole time slot, not after this game alone", () => {
    // After this game alone Kärpät would be 1st (3 pts, better goals than Tappara's 3);
    // Tappara's win in the same slot makes it 6 pts, so Kärpät are 2nd.
    expect(facts.standings).toEqual([
      { team: "Kärpät", rank_before: 2, rank_after: 2, points_before: 0, points_after: 3 },
      { team: "Ilves", rank_before: 3, rank_after: 3, points_before: 0, points_after: 0 },
    ]);
  });

  it("gives both teams season odds before and after, as probabilities", () => {
    expect(facts.odds.map((odds) => odds.team)).toEqual(["Kärpät", "Ilves"]);
    for (const odds of facts.odds) {
      for (const value of [...Object.values(odds.before), ...Object.values(odds.after)]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("finds each team's next game (Ilves has none)", () => {
    expect(facts.next_games).toEqual([
      { team: "Kärpät", opponent: "Jukurit", venue: "home", date: "2026-10-25" },
    ]);
  });

  it("has no season facts for a game outside the season data (demo fill-in)", () => {
    expect(compute_season_facts(DATA, { ...STORY_GAME, id: "demo_final" }, 200)).toEqual({
      standings: [],
      odds: [],
      next_games: [],
    });
  });
});

describe("known_names_of", () => {
  it("lists every team and player of the season", () => {
    expect(known_names_of(DATA)).toContainEqual({ name: "Eetu Laine", kind: "player" });
    expect(known_names_of(DATA)).toContainEqual({ name: "Jukurit", kind: "team" });
  });
});
