import { describe, expect, it } from "vitest";
import { pick_top_scorer, type ModelGoal, type ModelPlayer } from "./top_scorer_pick";
import { played } from "./test_helpers";

function player(
  id: string,
  team_id: string,
  position: ModelPlayer["position"] = "forward",
): ModelPlayer {
  return { id, team_id, first_name: "First", last_name: id, jersey_number: 10, position };
}

const PLAYERS = [
  player("laine", "a"),
  player("niemi", "a"),
  player("keeper", "a", "goalie"),
  player("other", "b"),
];
const HISTORY = Array.from({ length: 8 }, (_, index) =>
  played(`g${String(index)}`, index, "a", "b", 3, 2),
);

function goals(scorer_id: string, game_indexes: number[], team_id = "a"): ModelGoal[] {
  return game_indexes.map((index) => ({ game_id: `g${String(index)}`, team_id, scorer_id }));
}

describe("pick_top_scorer", () => {
  it("picks the best goals per game over the last 5 games", () => {
    const pick = pick_top_scorer({
      team_id: "a",
      players: PLAYERS,
      history: HISTORY,
      // niemi scored more in the season, laine more recently (games 3-7 are the last 5).
      goals: [...goals("niemi", [0, 0, 1, 1, 2, 2, 3]), ...goals("laine", [4, 5, 6])],
    });

    expect(pick).toEqual({
      player_id: "laine",
      team_id: "a",
      recent_goals: 3,
      recent_games: 5,
      goals_per_game: 0.6,
      season_goals: 3,
    });
  });

  it("never picks a goalie or a player of another team", () => {
    const pick = pick_top_scorer({
      team_id: "a",
      players: PLAYERS,
      history: HISTORY,
      goals: [
        ...goals("keeper", [7, 7]),
        ...goals("other", [7, 7, 7], "b"),
        ...goals("niemi", [1]),
      ],
    });

    expect(pick?.player_id).toBe("niemi");
  });

  it("needs at least 3 team games and a scorer", () => {
    expect(
      pick_top_scorer({
        team_id: "a",
        players: PLAYERS,
        history: HISTORY.slice(0, 2),
        goals: goals("laine", [0]),
      }),
    ).toBeNull();
    expect(
      pick_top_scorer({ team_id: "a", players: PLAYERS, history: HISTORY, goals: [] }),
    ).toBeNull();
  });
});
