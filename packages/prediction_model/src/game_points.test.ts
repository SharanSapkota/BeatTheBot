import { describe, expect, it } from "vitest";
import { get_game_points, type FinishedGame } from "./game_points";

function game(home_goals: number, away_goals: number, ended_in: FinishedGame["ended_in"]) {
  return { home_team_id: "home", away_team_id: "away", home_goals, away_goals, ended_in };
}

describe("get_game_points", () => {
  it("gives 3 points for a regulation win and 0 for the loss", () => {
    expect(get_game_points(game(3, 1, "regulation"))).toEqual({ home_points: 3, away_points: 0 });
    expect(get_game_points(game(0, 2, "regulation"))).toEqual({ home_points: 0, away_points: 3 });
  });

  it("gives 2 points for an overtime win and 1 for the loss", () => {
    expect(get_game_points(game(3, 2, "overtime"))).toEqual({ home_points: 2, away_points: 1 });
  });

  it("gives 2 points for a shootout win and 1 for the loss", () => {
    expect(get_game_points(game(2, 3, "shootout"))).toEqual({ home_points: 1, away_points: 2 });
  });

  it("rejects a tied final score", () => {
    expect(() => get_game_points(game(2, 2, "overtime"))).toThrow(/tie/);
  });
});
