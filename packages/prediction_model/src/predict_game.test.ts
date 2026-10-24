import { describe, expect, it } from "vitest";
import { predict_game } from "./predict_game";
import { played, round_robin, scheduled } from "./test_helpers";
import type { ModelPlayer } from "./top_scorer_pick";

const TEAMS = ["a", "b", "c", "d"];
const NAMES = new Map([
  ["a", "Kärpät"],
  ["b", "Ilves"],
  ["c", "Tappara"],
  ["d", "KalPa"],
]);
const PLAYERS: ModelPlayer[] = [
  {
    id: "p_a",
    team_id: "a",
    first_name: "Eetu",
    last_name: "Laine",
    jersey_number: 19,
    position: "forward",
  },
  {
    id: "p_b",
    team_id: "b",
    first_name: "Aleksi",
    last_name: "Mäkelä",
    jersey_number: 11,
    position: "forward",
  },
];

describe("predict_game", () => {
  const history = round_robin(TEAMS, (home, away) =>
    home === "a" ? [5, 1] : away === "a" ? [1, 4] : [3, 2],
  );
  const goals = history.flatMap((game) =>
    game.home_team_id === "a" || game.away_team_id === "a"
      ? [{ game_id: game.id, team_id: "a", scorer_id: "p_a" }]
      : [],
  );
  const game = scheduled("next", 50, "b", "a");
  const prediction = predict_game({
    game,
    team_names: NAMES,
    history,
    remaining_games: [game, scheduled("other", 51, "c", "d")],
    players: PLAYERS,
    goals,
    rules: { playoff_spots: 2, top_spots: 1, relegated_team_count: 1 },
    stakes_simulations: 500,
    seed: 3,
  });

  it("picks the stronger away team with a consistent score and scorer", () => {
    expect(prediction.predicted_winner_team_id).toBe("a");
    expect(prediction.away_win_probability).toBeGreaterThan(0.5);
    expect(prediction.home_win_probability + prediction.away_win_probability).toBeCloseTo(1, 10);
    expect(prediction.predicted_away_goals).toBeGreaterThan(prediction.predicted_home_goals);
    expect(prediction.scorer?.player_id).toBe("p_a");
  });

  it("explains the pick and shows what is at stake", () => {
    expect(prediction.reasons.length).toBeGreaterThan(0);
    expect(prediction.reasons.length).toBeLessThanOrEqual(3);
    expect(prediction.reasons.every((reason) => reason.favours_team_id === "a")).toBe(true);
    expect(prediction.stakes.highlights).toHaveLength(2);
  });

  it("uses only the history it is given", () => {
    const later = played("future", 60, "b", "a", 9, 0);
    const again = predict_game({
      game,
      team_names: NAMES,
      history,
      remaining_games: [game, scheduled("other", 51, "c", "d")],
      players: PLAYERS,
      goals: [...goals, { game_id: later.id, team_id: "b", scorer_id: "p_b" }],
      rules: { playoff_spots: 2, top_spots: 1, relegated_team_count: 1 },
      stakes_simulations: 500,
      seed: 3,
    });

    expect(again).toEqual(prediction);
  });
});
