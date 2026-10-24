import { describe, expect, it } from "vitest";
import {
  decide_next_goal,
  decide_period_goal,
  score_answer,
  type LiveGameState,
} from "./questions";

const HOME = "karpat";
const AWAY = "ilves";

function state(change: Partial<LiveGameState>): LiveGameState {
  return {
    home_team_id: HOME,
    away_team_id: AWAY,
    goals: [
      { team_id: HOME, period: 1 },
      { team_id: AWAY, period: 2 },
    ],
    period: 2,
    is_final: false,
    ...change,
  };
}

describe("decide_next_goal", () => {
  it("names the side of the goal once it is scored", () => {
    expect(decide_next_goal(state({}), 0)).toBe("home");
    expect(decide_next_goal(state({}), 1)).toBe("away");
  });

  it("is open while the game goes on, and 'none' when it ended without the goal", () => {
    expect(decide_next_goal(state({}), 2)).toBeNull();
    expect(decide_next_goal(state({ is_final: true }), 2)).toBe("none");
  });

  it("does not count the shootout winner as a goal", () => {
    const shootout = state({ goals: [{ team_id: HOME, period: 5 }], is_final: true });
    expect(decide_next_goal(shootout, 0)).toBe("none");
  });
});

describe("decide_period_goal", () => {
  it("is yes as soon as the period has a goal", () => {
    expect(decide_period_goal(state({}), 2)).toBe("yes");
  });

  it("is no once the period is over without a goal, open before that", () => {
    expect(decide_period_goal(state({ period: 3 }), 3)).toBeNull();
    expect(decide_period_goal(state({ period: 4 }), 3)).toBe("no");
    expect(decide_period_goal(state({ period: 3, is_final: true }), 3)).toBe("no");
  });
});

describe("score_answer", () => {
  it("gives next goal 5, period goal 3 and a quiz question 2 when right, 0 when wrong", () => {
    expect(score_answer({ question_type: "next_goal", correct_option: "home" }, "home")).toBe(5);
    expect(score_answer({ question_type: "next_goal", correct_option: "home" }, "away")).toBe(0);
    expect(score_answer({ question_type: "period_goal", correct_option: "no" }, "no")).toBe(3);
    expect(score_answer({ question_type: "result_quiz", correct_option: "b" }, "b")).toBe(2);
  });

  it("is null while the question is not decided", () => {
    expect(score_answer({ question_type: "next_goal", correct_option: null }, "home")).toBeNull();
  });

  it("gives 1 for any player vote and 0 for the fan poll", () => {
    expect(score_answer({ question_type: "player_vote", correct_option: null }, "p1")).toBe(1);
    expect(score_answer({ question_type: "poll", correct_option: null }, "p1")).toBe(0);
  });
});
