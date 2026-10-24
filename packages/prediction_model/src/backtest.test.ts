import { describe, expect, it } from "vitest";
import { backtest } from "./backtest";
import { played, round_robin } from "./test_helpers";

const TEAMS = ["a", "b", "c", "d"];

describe("backtest", () => {
  // "a" always wins, three times over.
  const season = [0, 1, 2]
    .flatMap(() =>
      round_robin(TEAMS, (home, away) => (home === "a" ? [5, 1] : away === "a" ? [1, 4] : [3, 2])),
    )
    .map((game, index) => ({
      ...game,
      id: `g${String(index)}`,
      start_time: new Date(Date.UTC(2026, 8, 1) + index * 86_400_000),
    }));

  it("reports accuracy, Brier score and calibration buckets", () => {
    const result = backtest(TEAMS, season);

    expect(result.games + result.skipped_games).toBe(season.length);
    expect(result.accuracy).toBeGreaterThan(0.8);
    expect(result.brier_score).toBeGreaterThan(0);
    expect(result.brier_score).toBeLessThan(result.baseline_brier_score);
    expect(result.calibration.map((bucket) => bucket.label)).toEqual([
      "50–60%",
      "60–70%",
      "70–80%",
      "80–90%",
      "90–100%",
    ]);
    expect(result.calibration.reduce((sum, bucket) => sum + bucket.games, 0)).toBe(result.games);
  });

  it("only uses games before each game (adding later games changes nothing earlier)", () => {
    const first_half = season.slice(0, 20);
    const later = [...first_half, played("late", 400, "d", "a", 9, 0)];

    expect(backtest(TEAMS, later).games).toBe(backtest(TEAMS, first_half).games + 1);
    // Each earlier prediction is the same, so the sums over the first 20 games agree.
    const without = backtest(TEAMS, first_half);
    const with_late = backtest(TEAMS, later);
    expect(with_late.accuracy * with_late.games).toBeLessThanOrEqual(
      without.accuracy * without.games + 1,
    );
    expect(with_late.accuracy * with_late.games).toBeGreaterThanOrEqual(
      without.accuracy * without.games,
    );
  });

  it("skips games where a team has too little history", () => {
    expect(backtest(TEAMS, season, { min_team_games: 100 }).games).toBe(0);
  });
});
