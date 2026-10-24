import { describe, expect, it } from "vitest";
import { game_probabilities } from "./game_probabilities";
import {
  build_win_chance_timeline,
  live_home_win_probability,
  REGULATION_SECONDS,
} from "./live_win_chance";

const MODEL = { expected_goals: { home: 3.1, away: 2.5 }, overtime_home_share: 0.53 };

describe("live_home_win_probability", () => {
  it("equals the pre-game chance at puck drop", () => {
    const pre_game = game_probabilities(MODEL.expected_goals);
    const at_start = live_home_win_probability(
      { home_goals: 0, away_goals: 0, elapsed_seconds: 0 },
      { ...MODEL, overtime_home_share: pre_game.overtime_home_share },
    );

    expect(at_start).toBeCloseTo(pre_game.home_win, 10);
  });

  it("goes to 100% when leading at the final second and 0% when trailing", () => {
    const final_second = REGULATION_SECONDS - 1;

    expect(
      live_home_win_probability(
        { home_goals: 2, away_goals: 1, elapsed_seconds: final_second },
        MODEL,
      ),
    ).toBeGreaterThan(0.999);
    expect(
      live_home_win_probability(
        { home_goals: 2, away_goals: 1, elapsed_seconds: REGULATION_SECONDS },
        MODEL,
      ),
    ).toBe(1);
    expect(
      live_home_win_probability(
        { home_goals: 0, away_goals: 1, elapsed_seconds: REGULATION_SECONDS },
        MODEL,
      ),
    ).toBe(0);
  });

  it("uses the overtime share when tied after 60 minutes", () => {
    expect(
      live_home_win_probability(
        { home_goals: 1, away_goals: 1, elapsed_seconds: REGULATION_SECONDS },
        MODEL,
      ),
    ).toBe(0.53);
  });

  it("rises after a home goal and as time runs out with a lead", () => {
    const at = (home_goals: number, elapsed_seconds: number) =>
      live_home_win_probability({ home_goals, away_goals: 0, elapsed_seconds }, MODEL);

    expect(at(1, 600)).toBeGreaterThan(at(0, 600));
    expect(at(1, 3000)).toBeGreaterThan(at(1, 600));
  });
});

describe("build_win_chance_timeline", () => {
  const goals = [
    { game_time_seconds: 2112, side: "away" as const },
    { game_time_seconds: 877, side: "home" as const },
  ];

  it("has a point at puck drop, one per goal and one for now", () => {
    const points = build_win_chance_timeline({ model: MODEL, goals, now_seconds: 2461 });

    expect(points.map((point) => [point.kind, point.home_goals, point.away_goals])).toEqual([
      ["start", 0, 0],
      ["goal", 1, 0],
      ["goal", 1, 1],
      ["now", 1, 1],
    ]);
    expect(points[1]?.home_win_probability ?? 0).toBeGreaterThan(
      points[0]?.home_win_probability ?? 1,
    );
  });

  it("ignores goals after now", () => {
    const points = build_win_chance_timeline({ model: MODEL, goals, now_seconds: 1000 });

    expect(points.map((point) => point.kind)).toEqual(["start", "goal", "now"]);
  });

  it("ends at 100% or 0% for a final game", () => {
    const points = build_win_chance_timeline({ model: MODEL, goals, final_winner: "away" });

    expect(points.at(-1)).toMatchObject({ kind: "end", home_win_probability: 0 });
  });
});
