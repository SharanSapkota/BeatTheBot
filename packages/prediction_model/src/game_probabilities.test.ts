import { describe, expect, it } from "vitest";
import { expected_goals, game_probabilities, overtime_home_share } from "./game_probabilities";
import { compute_team_strengths } from "./team_strength";
import { round_robin } from "./test_helpers";

describe("game_probabilities", () => {
  it("adds up to 1", () => {
    const result = game_probabilities({ home: 3.2, away: 2.4 });

    expect(result.home_regulation_win + result.away_regulation_win + result.overtime).toBeCloseTo(
      1,
      10,
    );
    expect(result.home_win + result.away_win).toBeCloseTo(1, 10);
  });

  it("is 50/50 for equal expected goals", () => {
    const result = game_probabilities({ home: 2.8, away: 2.8 });

    expect(result.home_win).toBeCloseTo(0.5, 10);
    expect(result.overtime_home_share).toBeCloseTo(0.5, 10);
  });

  it("gives equal teams only the measured home advantage", () => {
    const teams = ["a", "b", "c", "d"];
    const model = compute_team_strengths(
      teams,
      round_robin(teams, () => [3, 2]),
    );
    const result = game_probabilities(expected_goals(model, "a", "b"));

    // Recency weights differ a little by schedule order, so "equal" is within 1%.
    expect(model.teams.get("a")?.attack).toBeCloseTo(1, 2);
    expect(result.home_win).toBeGreaterThan(0.5);
    expect(result.home_win).toBeLessThan(0.7);
    expect(result.predicted_winner).toBe("home");
  });

  it("predicts a score in which the predicted winner wins", () => {
    const home_favourite = game_probabilities({ home: 3.5, away: 2.0 });
    const away_favourite = game_probabilities({ home: 2.0, away: 3.5 });

    expect(home_favourite.predicted_score.home).toBeGreaterThan(
      home_favourite.predicted_score.away,
    );
    expect(away_favourite.predicted_winner).toBe("away");
    expect(away_favourite.predicted_score.away).toBeGreaterThan(
      away_favourite.predicted_score.home,
    );
  });

  it("splits overtime close to 50/50, a little toward the stronger team", () => {
    const share = overtime_home_share({ home: 4, away: 2 });

    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.6);
  });

  it("throws for a team without strength", () => {
    const model = compute_team_strengths(["a"], []);

    expect(() => expected_goals(model, "a", "x")).toThrow(/No strength/);
  });
});
