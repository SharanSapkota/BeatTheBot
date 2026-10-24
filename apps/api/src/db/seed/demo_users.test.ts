import { describe, expect, it } from "vitest";
import { build_demo_predictions, build_demo_users, type PredictionTarget } from "./demo_users";

const AWAY_WIN: PredictionTarget = {
  game_id: "game",
  home_team_id: "home_team",
  away_team_id: "away_team",
  home_goals: 2,
  away_goals: 4,
  home_scorer_id: "home_scorer",
  away_scorer_id: "away_scorer",
};

describe("build_demo_users", () => {
  it("makes the first user the editor with the given email", () => {
    const users = build_demo_users("Editor@Kaleva.FI");

    expect(users[0]).toMatchObject({ role: "editor", email: "editor@kaleva.fi" });
    expect(users.slice(1).every((user) => user.role === "user" && user.email === null)).toBe(true);
    expect(new Set(users.map((user) => user.device_id)).size).toBe(users.length);
  });
});

describe("build_demo_predictions", () => {
  it("orients picks as home-away when the away team won", () => {
    const [exact, , wrong_winner] = build_demo_predictions(AWAY_WIN);

    expect(exact).toEqual({
      device_id: "demo_device_mika",
      game_id: "game",
      predicted_winner_team_id: "away_team",
      predicted_home_goals: 2,
      predicted_away_goals: 4,
      predicted_scorer_id: "away_scorer",
    });
    expect(wrong_winner).toMatchObject({
      predicted_winner_team_id: "home_team",
      predicted_home_goals: 3,
      predicted_away_goals: 2,
      predicted_scorer_id: "home_scorer",
    });
  });

  it("always predicts a winner that matches the predicted score", () => {
    for (const prediction of build_demo_predictions(AWAY_WIN)) {
      const home_wins = prediction.predicted_home_goals > prediction.predicted_away_goals;
      expect(prediction.predicted_winner_team_id).toBe(home_wins ? "home_team" : "away_team");
    }
  });

  it("gives one pick per demo player", () => {
    const player_ids = build_demo_users("e@x.fi")
      .filter((user) => user.role === "user")
      .map((user) => user.device_id);

    expect(build_demo_predictions(AWAY_WIN).map((prediction) => prediction.device_id)).toEqual(
      player_ids,
    );
  });
});
