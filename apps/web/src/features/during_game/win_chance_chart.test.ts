import { describe, expect, it } from "vitest";
import { point_label } from "./win_chance_chart";

function point(kind: "start" | "goal" | "now" | "end", home_goals = 0, away_goals = 0) {
  return { kind, game_time_seconds: 0, home_goals, away_goals, home_win_probability: 0.5 };
}

describe("point_label", () => {
  it("labels the start, each goal's score and the end, not now", () => {
    expect(point_label(point("start"))).toBe("Start");
    expect(point_label(point("goal", 1, 0))).toBe("1–0");
    expect(point_label(point("now", 1, 1))).toBe("");
    expect(point_label(point("end", 2, 1))).toBe("End");
  });
});
