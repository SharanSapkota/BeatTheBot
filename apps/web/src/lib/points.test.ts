import type { GameDetail, ResultQuiz } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { ILVES, KARPAT, LAINE, MAKELA, build_game } from "../test_helpers/game_fixture";
import { EMPTY_PICKS, type GamePicks } from "./picks";
import {
  compute_game_points,
  live_points,
  possible_points,
  score_after_regulation,
  type AiPick,
} from "./points";

const FINAL = build_game("final"); // Kärpät 3-1 Ilves
const AI_KARPAT: AiPick = {
  winner_team_id: KARPAT.id,
  home_goals: 2,
  away_goals: 1,
  scorer_id: LAINE.id,
};
const AI_ILVES: AiPick = {
  winner_team_id: ILVES.id,
  home_goals: 1,
  away_goals: 2,
  scorer_id: MAKELA.id,
};

const QUIZ: ResultQuiz = {
  points_each: 2,
  questions: ["q1", "q2", "q3"].map((id) => ({
    id,
    prompt: id,
    options: ["a", "b"],
    correct_option: "a",
    explanation_right: "",
    explanation_wrong: "",
  })),
};

function picks(change: Partial<GamePicks>): GamePicks {
  return { ...EMPTY_PICKS, locked_at: "2026-10-24T12:00:00.000Z", ...change };
}

describe("compute_game_points", () => {
  it("gives the design's numbers: you 38, the AI 25", () => {
    const points = compute_game_points({
      game: FINAL,
      ai_pick: AI_KARPAT,
      quiz: null,
      picks: picks({
        winner_team_id: KARPAT.id,
        home_goals: 3,
        away_goals: 2,
        scorer_id: LAINE.id,
        next_goal_picks: [
          { goal_index: 2, choice: "home" },
          { goal_index: 3, choice: "home" },
        ],
        period_goal: { period: 3, answer: "yes" },
      }),
    });

    expect(points).toMatchObject({
      winner: 10,
      exact_score: 0,
      scorer: 15,
      beat_ai: null,
      next_goal: { correct: 2, decided: 2, points: 10 },
      period_goal: 3,
      total: 38,
      ai_total: 25,
    });
  });

  it.each<[string, Partial<GamePicks>, AiPick | null, number]>([
    ["winner only", { winner_team_id: KARPAT.id, home_goals: 0, away_goals: 0 }, AI_KARPAT, 10],
    [
      "winner + exact score",
      { winner_team_id: KARPAT.id, home_goals: 3, away_goals: 1 },
      AI_KARPAT,
      35,
    ],
    [
      "all three pre-game picks",
      { winner_team_id: KARPAT.id, home_goals: 3, away_goals: 1, scorer_id: LAINE.id },
      AI_KARPAT,
      50,
    ],
    [
      "right when the AI was wrong: +5",
      { winner_team_id: KARPAT.id, home_goals: 0, away_goals: 0 },
      AI_ILVES,
      15,
    ],
    [
      "wrong winner gets no bonus",
      { winner_team_id: ILVES.id, home_goals: 0, away_goals: 0 },
      AI_KARPAT,
      0,
    ],
    [
      "scorer who scored, wrong winner",
      { winner_team_id: ILVES.id, home_goals: 0, away_goals: 0, scorer_id: MAKELA.id },
      AI_KARPAT,
      15,
    ],
    [
      "next goal 'none' is wrong when a goal came",
      { next_goal_picks: [{ goal_index: 3, choice: "none" }] },
      null,
      0,
    ],
    [
      "next goal 'none' is right after the last goal",
      { next_goal_picks: [{ goal_index: 4, choice: "none" }] },
      null,
      5,
    ],
    ["goal in the 3rd period: yes", { period_goal: { period: 3, answer: "yes" } }, null, 3],
    ["goal in the 3rd period: no", { period_goal: { period: 3, answer: "no" } }, null, 0],
    ["vote", { vote_player: "Eetu Laine" }, null, 1],
  ])("%s", (_name, change, ai_pick, expected_total) => {
    const base =
      change.winner_team_id === undefined ? { ...EMPTY_PICKS, ...change } : picks(change);
    expect(compute_game_points({ game: FINAL, ai_pick, quiz: null, picks: base }).total).toBe(
      expected_total,
    );
  });

  it("gives 2 points per correct quiz answer", () => {
    const points = compute_game_points({
      game: FINAL,
      ai_pick: null,
      quiz: QUIZ,
      picks: { ...EMPTY_PICKS, quiz_answers: { q1: "a", q2: "b", q3: "a" } },
    });

    expect(points.quiz).toEqual({ correct: 2, answered: 3, points: 4 });
  });

  it("gives nothing for picks the user did not make", () => {
    const points = compute_game_points({
      game: FINAL,
      ai_pick: AI_KARPAT,
      quiz: QUIZ,
      picks: EMPTY_PICKS,
    });

    expect(points).toMatchObject({
      winner: null,
      exact_score: null,
      scorer: null,
      vote: null,
      total: 0,
    });
  });

  it("counts only decided live picks while the game is on", () => {
    const live = build_game("live"); // 1-1, two goals so far, 2nd period
    const points = compute_game_points({
      game: live,
      ai_pick: AI_KARPAT,
      quiz: null,
      picks: {
        ...EMPTY_PICKS,
        next_goal_picks: [
          { goal_index: 1, choice: "away" },
          { goal_index: 2, choice: "home" },
        ],
        period_goal: { period: 3, answer: "yes" },
      },
    });

    expect(points.next_goal).toEqual({ correct: 1, decided: 1, points: 5 });
    expect(points.period_goal).toBeNull();
    expect(points.winner).toBeNull();
    expect(live_points(points)).toBe(5);
  });
});

describe("score_after_regulation", () => {
  it("leaves out the overtime winner", () => {
    const overtime: GameDetail = {
      ...FINAL,
      home_goals: 2,
      away_goals: 1,
      ended_in: "overtime",
      events: [],
    };

    expect(score_after_regulation(overtime)).toEqual({ home: 1, away: 1 });
    expect(score_after_regulation(FINAL)).toEqual({ home: 3, away: 1 });
  });
});

describe("possible_points", () => {
  it("is 50, or 55 when picking against the AI", () => {
    expect(possible_points({ ...EMPTY_PICKS, winner_team_id: KARPAT.id }, AI_KARPAT)).toBe(50);
    expect(possible_points({ ...EMPTY_PICKS, winner_team_id: ILVES.id }, AI_KARPAT)).toBe(55);
  });
});
