import { describe, expect, it } from "vitest";
import type { FinishedGame } from "./game_points";
import { compute_standings } from "./standings";

function game(
  home_team_id: string,
  away_team_id: string,
  home_goals: number,
  away_goals: number,
  ended_in: FinishedGame["ended_in"] = "regulation",
): FinishedGame {
  return { home_team_id, away_team_id, home_goals, away_goals, ended_in };
}

describe("compute_standings", () => {
  it("adds up points, games and goals for every team", () => {
    const standings = compute_standings(
      ["a", "b", "c"],
      [game("a", "b", 3, 1), game("b", "c", 2, 3, "overtime"), game("c", "a", 1, 4)],
    );

    expect(standings).toEqual([
      { team_id: "a", rank: 1, games_played: 2, points: 6, goals_for: 7, goals_against: 2 },
      { team_id: "c", rank: 2, games_played: 2, points: 2, goals_for: 4, goals_against: 6 },
      { team_id: "b", rank: 3, games_played: 2, points: 1, goals_for: 3, goals_against: 6 },
    ]);
  });

  it("breaks ties on goal difference, then goals for, then team id", () => {
    const standings = compute_standings(
      ["x", "y", "z", "w"],
      [game("x", "w", 5, 1), game("y", "w", 2, 1), game("z", "w", 3, 2)],
    );

    expect(standings.map((row) => row.team_id)).toEqual(["x", "z", "y", "w"]);
  });

  it("includes teams without games", () => {
    const standings = compute_standings(["a", "b"], []);

    expect(standings.map((row) => row.games_played)).toEqual([0, 0]);
  });

  it("rejects a game with an unknown team", () => {
    expect(() => compute_standings(["a"], [game("a", "b", 1, 0)])).toThrow(/unknown team/);
  });
});
