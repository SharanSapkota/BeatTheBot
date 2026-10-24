import { describe, expect, it } from "vitest";
import {
  has_scored,
  score_after_regulation,
  winner_team_id,
  type GameResult,
  type ResultGoal,
} from "./game_result";

const HOME = "home-team";
const AWAY = "away-team";

function goal(team_id: string, period: number, player_id = "player"): ResultGoal {
  return { team_id, period, player_id };
}

function result(change: Partial<GameResult>): GameResult {
  return {
    home_team_id: HOME,
    away_team_id: AWAY,
    home_goals: 0,
    away_goals: 0,
    ended_in: "regulation",
    goals: [],
    ...change,
  };
}

describe("winner_team_id", () => {
  it("is the team with more goals, null for a tie", () => {
    expect(winner_team_id(result({ home_goals: 3, away_goals: 1 }))).toBe(HOME);
    expect(winner_team_id(result({ home_goals: 1, away_goals: 2 }))).toBe(AWAY);
    expect(winner_team_id(result({ home_goals: 2, away_goals: 2 }))).toBeNull();
  });
});

describe("score_after_regulation", () => {
  it("counts only goals in periods 1–3", () => {
    const overtime_win = result({
      home_goals: 3,
      away_goals: 2,
      ended_in: "overtime",
      goals: [goal(HOME, 1), goal(AWAY, 2), goal(HOME, 2), goal(AWAY, 3), goal(HOME, 4)],
    });

    expect(score_after_regulation(overtime_win)).toEqual({ home: 2, away: 2 });
  });

  it("without events, takes the deciding goal off the winner after 60 minutes", () => {
    expect(
      score_after_regulation(result({ home_goals: 2, away_goals: 3, ended_in: "shootout" })),
    ).toEqual({ home: 2, away: 2 });
    expect(score_after_regulation(result({ home_goals: 4, away_goals: 1 }))).toEqual({
      home: 4,
      away: 1,
    });
  });
});

describe("has_scored", () => {
  it("ignores shootout goals and a missing player", () => {
    const shootout = result({ goals: [goal(HOME, 5, "laine"), goal(HOME, 2, "niemi")] });

    expect(has_scored(shootout, "niemi")).toBe(true);
    expect(has_scored(shootout, "laine")).toBe(false);
    expect(has_scored(shootout, null)).toBe(false);
  });
});
