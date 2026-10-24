import type { Crowd, GameDetail } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { ILVES, KARPAT, LAINE, MAKELA, build_game } from "../test_helpers/game_fixture";
import { DRAW_PICK, EMPTY_PICKS, type GamePicks } from "./picks";
import {
  compute_game_points,
  live_points,
  possible_points,
  score_after_regulation,
} from "./points";
import { make_question } from "../test_helpers/questions";

const FINAL = build_game("final"); // Kärpät 3-1 Ilves
/** 80 of 100 fans picked Kärpät: a right Kärpät pick is not a bold call. */
const FANS_ON_KARPAT: Crowd = {
  total_picks: 100,
  home_picks: 80,
  away_picks: 20,
  draw_picks: 0,
  home_pick_share: 0.8,
};
/** Only 10 of 50 fans (20%) picked Kärpät: a right Kärpät pick is a bold call (+5). */
const FANS_ON_ILVES: Crowd = {
  total_picks: 50,
  home_picks: 10,
  away_picks: 40,
  draw_picks: 0,
  home_pick_share: 0.2,
};

const QUIZ = ["q1", "q2", "q3"].map((id) => make_question({ id }));

function picks(change: Partial<GamePicks>): GamePicks {
  return { ...EMPTY_PICKS, locked_at: "2026-10-24T12:00:00.000Z", ...change };
}

describe("compute_game_points", () => {
  it("gives the design's numbers: you 38", () => {
    const points = compute_game_points({
      game: FINAL,
      crowd: FANS_ON_KARPAT,
      quiz: [],
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
      bold_call: null,
      next_goal: { correct: 2, decided: 2, points: 10 },
      period_goal: 3,
      total: 38,
    });
  });

  it.each<[string, Partial<GamePicks>, Crowd | null, number]>([
    [
      "winner only",
      { winner_team_id: KARPAT.id, home_goals: 0, away_goals: 0 },
      FANS_ON_KARPAT,
      10,
    ],
    [
      "winner + exact score",
      { winner_team_id: KARPAT.id, home_goals: 3, away_goals: 1 },
      FANS_ON_KARPAT,
      35,
    ],
    [
      "all three pre-game picks",
      { winner_team_id: KARPAT.id, home_goals: 3, away_goals: 1, scorer_id: LAINE.id },
      FANS_ON_KARPAT,
      50,
    ],
    [
      "bold call: right when fewer than 30% of fans picked it: +5",
      { winner_team_id: KARPAT.id, home_goals: 0, away_goals: 0 },
      FANS_ON_ILVES,
      15,
    ],
    [
      "wrong winner gets no bonus",
      { winner_team_id: ILVES.id, home_goals: 0, away_goals: 0 },
      FANS_ON_KARPAT,
      0,
    ],
    [
      "scorer who scored, wrong winner",
      { winner_team_id: ILVES.id, home_goals: 0, away_goals: 0, scorer_id: MAKELA.id },
      FANS_ON_KARPAT,
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
  ])("%s", (_name, change, crowd, expected_total) => {
    const base =
      change.winner_team_id === undefined ? { ...EMPTY_PICKS, ...change } : picks(change);
    expect(compute_game_points({ game: FINAL, crowd, quiz: [], picks: base }).total).toBe(
      expected_total,
    );
  });

  it("gives 2 points per correct quiz answer", () => {
    const points = compute_game_points({
      game: FINAL,
      crowd: null,
      quiz: QUIZ,
      picks: { ...EMPTY_PICKS, quiz_answers: { q1: "a", q2: "b", q3: "a" } },
    });

    expect(points.quiz).toEqual({ correct: 2, answered: 3, points: 4 });
  });

  it("gives nothing for picks the user did not make", () => {
    const points = compute_game_points({
      game: FINAL,
      crowd: FANS_ON_KARPAT,
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
      crowd: FANS_ON_KARPAT,
      quiz: [],
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
  it("is 50, or 55 when the pick would be a bold call", () => {
    const game = build_game("upcoming");
    expect(
      possible_points({ ...EMPTY_PICKS, winner_team_id: KARPAT.id }, game, FANS_ON_KARPAT),
    ).toBe(50);
    expect(
      possible_points({ ...EMPTY_PICKS, winner_team_id: ILVES.id }, game, FANS_ON_KARPAT),
    ).toBe(55);
    expect(possible_points({ ...EMPTY_PICKS, winner_team_id: ILVES.id }, game, null)).toBe(50);
  });
});

describe("compute_game_points per sport", () => {
  // Kärpät 1–1 Ilves (football): Laine and Mäkelä score.
  const FOOTBALL_DRAW: GameDetail = build_game("final", {
    sport: "football",
    home_goals: 1,
    away_goals: 1,
    events: [
      { ...FINAL.events[0], period: 1 } as GameDetail["events"][number],
      { ...FINAL.events[1], period: 2 } as GameDetail["events"][number],
    ],
  });
  /** 20 fans, 4 on the draw (20%): a right draw is a bold call. */
  const FANS_ON_TEAMS: Crowd = {
    total_picks: 20,
    home_picks: 10,
    away_picks: 6,
    draw_picks: 4,
    home_pick_share: 0.5,
  };

  it("scores a right football draw: 1X2, exact score, scorer and the bold call", () => {
    const points = compute_game_points({
      game: FOOTBALL_DRAW,
      crowd: FANS_ON_TEAMS,
      quiz: [],
      picks: picks({
        winner_team_id: DRAW_PICK,
        home_goals: 1,
        away_goals: 1,
        scorer_id: MAKELA.id,
      }),
    });

    expect(points).toMatchObject({ winner: 10, exact_score: 25, scorer: 15, bold_call: 5 });
    expect(points.total).toBe(55);
  });

  it("gives a team pick nothing when the football game is drawn", () => {
    const points = compute_game_points({
      game: FOOTBALL_DRAW,
      crowd: null,
      quiz: [],
      picks: picks({ winner_team_id: KARPAT.id, home_goals: 2, away_goals: 1, scorer_id: null }),
    });

    expect([points.winner, points.exact_score]).toEqual([0, 0]);
  });

  it("scores basketball: winner, margin band, top scorer; no exact score", () => {
    const game = build_game("final", {
      sport: "basketball",
      home_goals: 88,
      away_goals: 81,
      events: [],
      top_scorer: LAINE,
    });
    const points = compute_game_points({
      game,
      crowd: null,
      quiz: [],
      picks: picks({ winner_team_id: KARPAT.id, margin_band: "6_10", scorer_id: LAINE.id }),
    });

    expect(points).toMatchObject({
      winner: 10,
      exact_score: null,
      scorer: null,
      margin_band: 15,
      top_scorer: 15,
    });
    expect(points.total).toBe(40);
    expect(possible_points(picks({ winner_team_id: ILVES.id }), game, null)).toBe(40);
  });
});
