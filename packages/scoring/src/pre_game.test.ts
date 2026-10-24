import { describe, expect, it } from "vitest";
import type { GameResult } from "./game_result";
import {
  DRAW_KEY,
  max_pick_points,
  score_pre_game,
  type CrowdSplit,
  type PreGamePick,
} from "./pre_game";
import type { SportId } from "./sports";

const HOME = "karpat";
const AWAY = "ilves";

// The design's example: Kärpät beat Ilves 3–1, Laine scores twice.
const KARPAT_3_1: GameResult = {
  home_team_id: HOME,
  away_team_id: AWAY,
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
  goals: [
    { team_id: HOME, period: 1, player_id: "laine" },
    { team_id: AWAY, period: 2, player_id: "makela" },
    { team_id: HOME, period: 2, player_id: "niemi" },
    { team_id: HOME, period: 3, player_id: "laine" },
  ],
};

function pick(change: Partial<PreGamePick>): PreGamePick {
  return {
    winner_team_id: HOME,
    home_goals: 3,
    away_goals: 2,
    scorer_id: "laine",
    margin_band: null,
    ...change,
  };
}

function crowd(home: number, away: number, draw = 0): CrowdSplit {
  return {
    total_picks: home + away + draw,
    picks_by_team: { [HOME]: home, [AWAY]: away, [DRAW_KEY]: draw },
  };
}

describe("score_pre_game: hockey", () => {
  it("gives winner + scorer points and 0 for a wrong exact score", () => {
    expect(score_pre_game("hockey", pick({}), KARPAT_3_1, null)).toEqual({
      winner: 10,
      exact_score: 0,
      scorer: 15,
      margin_band: 0,
      top_scorer: 0,
      bold_call: 0,
      total: 25,
    });
  });

  it("gives all points for a perfect pick", () => {
    expect(score_pre_game("hockey", pick({ away_goals: 1 }), KARPAT_3_1, null).total).toBe(50);
  });

  it("gives 0 for a wrong winner and a scorer who didn't score", () => {
    const points = score_pre_game(
      "hockey",
      pick({ winner_team_id: AWAY, scorer_id: "koskinen" }),
      KARPAT_3_1,
      crowd(2, 30),
    );
    expect(points.total).toBe(0);
  });

  it("never treats a missing winner as a draw pick (hockey has no draws)", () => {
    const tie: GameResult = { ...KARPAT_3_1, home_goals: 2, away_goals: 2, goals: [] };
    expect(score_pre_game("hockey", pick({ winner_team_id: null }), tie, null).winner).toBe(0);
  });

  it("counts the exact score after 60 minutes (not the overtime winner)", () => {
    const overtime: GameResult = {
      ...KARPAT_3_1,
      home_goals: 3,
      away_goals: 2,
      ended_in: "overtime",
      goals: [
        { team_id: HOME, period: 1, player_id: "a" },
        { team_id: HOME, period: 2, player_id: "b" },
        { team_id: AWAY, period: 2, player_id: "c" },
        { team_id: AWAY, period: 3, player_id: "d" },
        { team_id: HOME, period: 4, player_id: "e" },
      ],
    };
    const points = score_pre_game("hockey", pick({ home_goals: 2, away_goals: 2 }), overtime, null);
    expect(points.exact_score).toBe(25);
  });
});

describe("score_pre_game: football (1X2, exact score, scorer)", () => {
  // A 2–2 draw (Ali and Virta for home, Berg twice for away) and a 1–0 home win (Ali).
  const DRAW_2_2: GameResult = {
    home_team_id: HOME,
    away_team_id: AWAY,
    home_goals: 2,
    away_goals: 2,
    ended_in: "regulation",
    goals: [
      { team_id: HOME, period: 1, player_id: "ali" },
      { team_id: AWAY, period: 1, player_id: "berg" },
      { team_id: AWAY, period: 2, player_id: "berg" },
      { team_id: HOME, period: 2, player_id: "virta" },
    ],
  };
  const HOME_1_0: GameResult = {
    ...DRAW_2_2,
    home_goals: 1,
    away_goals: 0,
    goals: [{ team_id: HOME, period: 2, player_id: "ali" }],
  };

  // [label, pick, result, expected parts]
  const cases: [string, Partial<PreGamePick>, GameResult, number, number, number][] = [
    [
      "draw picked, draw, exact 2–2, scorer",
      { winner_team_id: null, home_goals: 2, away_goals: 2, scorer_id: "berg" },
      DRAW_2_2,
      10,
      25,
      15,
    ],
    [
      "draw picked, draw, wrong score",
      { winner_team_id: null, home_goals: 1, away_goals: 1, scorer_id: null },
      DRAW_2_2,
      10,
      0,
      0,
    ],
    [
      "home picked, draw",
      { winner_team_id: HOME, home_goals: 2, away_goals: 1, scorer_id: "ali" },
      DRAW_2_2,
      0,
      0,
      15,
    ],
    [
      "draw picked, home win",
      { winner_team_id: null, home_goals: 0, away_goals: 0, scorer_id: null },
      HOME_1_0,
      0,
      0,
      0,
    ],
    [
      "home picked, home win 1–0, first scorer",
      { winner_team_id: HOME, home_goals: 1, away_goals: 0, scorer_id: "ali" },
      HOME_1_0,
      10,
      25,
      15,
    ],
    [
      "away picked, home win, scorer did not score",
      { winner_team_id: AWAY, home_goals: 0, away_goals: 1, scorer_id: "berg" },
      HOME_1_0,
      0,
      0,
      0,
    ],
  ];

  it.each(cases)("%s", (_label, change, result, winner, exact_score, scorer) => {
    const points = score_pre_game("football", pick(change), result, null);
    expect([points.winner, points.exact_score, points.scorer]).toEqual([
      winner,
      exact_score,
      scorer,
    ]);
    expect(points.total).toBe(winner + exact_score + scorer);
  });

  it("gives a bold call for a right draw that fewer than 30% of the fans picked", () => {
    const points = score_pre_game(
      "football",
      pick({ winner_team_id: null, home_goals: 0, away_goals: 0 }),
      DRAW_2_2,
      crowd(12, 10, 3),
    );
    expect(points.bold_call).toBe(5);
  });
});

describe("score_pre_game: basketball (winner, margin band, top scorer)", () => {
  function basketball(home: number, away: number, top_scorer_id: string | null): GameResult {
    return {
      home_team_id: HOME,
      away_team_id: AWAY,
      home_goals: home,
      away_goals: away,
      ended_in: "regulation",
      goals: [],
      top_scorer_id,
    };
  }

  // [label, pick, result, winner, margin band, top scorer]
  const cases: [string, Partial<PreGamePick>, GameResult, number, number, number][] = [
    [
      "home by 3, band 1–5, top scorer",
      { winner_team_id: HOME, margin_band: "1_5", scorer_id: "koivu" },
      basketball(88, 85, "koivu"),
      10,
      15,
      15,
    ],
    [
      "home by 5 is still 1–5",
      { winner_team_id: HOME, margin_band: "1_5", scorer_id: null },
      basketball(80, 75, "koivu"),
      10,
      15,
      0,
    ],
    [
      "home by 6 is 6–10",
      { winner_team_id: HOME, margin_band: "1_5", scorer_id: null },
      basketball(81, 75, "koivu"),
      10,
      0,
      0,
    ],
    [
      "away by 10 is 6–10",
      { winner_team_id: AWAY, margin_band: "6_10", scorer_id: "lee" },
      basketball(70, 80, "koivu"),
      10,
      15,
      0,
    ],
    [
      "home by 11 is 11+",
      { winner_team_id: HOME, margin_band: "11_plus", scorer_id: "koivu" },
      basketball(99, 88, "koivu"),
      10,
      15,
      15,
    ],
    [
      "right band but wrong winner: no band points",
      { winner_team_id: AWAY, margin_band: "1_5", scorer_id: "koivu" },
      basketball(88, 85, "koivu"),
      0,
      0,
      15,
    ],
    [
      "no band picked",
      { winner_team_id: HOME, margin_band: null, scorer_id: null },
      basketball(88, 85, null),
      10,
      0,
      0,
    ],
  ];

  it.each(cases)("%s", (_label, change, result, winner, margin_band, top_scorer) => {
    const points = score_pre_game("basketball", pick(change), result, null);
    expect([points.winner, points.margin_band, points.top_scorer]).toEqual([
      winner,
      margin_band,
      top_scorer,
    ]);
    // Basketball has no exact score or "any scorer" pick.
    expect([points.exact_score, points.scorer]).toEqual([0, 0]);
  });
});

describe("bold call (+5), every sport", () => {
  // [crowd for the right winner, crowd for the other team, user picked, bold call points]
  const cases: [string, number, number, string, number][] = [
    ["right, 29% of 100 fans", 29, 71, HOME, 5],
    ["right, exactly 30%: not bold", 30, 70, HOME, 0],
    ["right, 31%", 31, 69, HOME, 0],
    ["right, 2 of 20 fans (10%)", 2, 18, HOME, 5],
    ["right, 5 of 20 fans (25%)", 5, 15, HOME, 5],
    ["right, 1 of 19 fans: too few picks", 1, 18, HOME, 0],
    ["wrong winner with a small crowd share", 71, 29, AWAY, 0],
  ];
  const sports: SportId[] = ["hockey", "football", "basketball"];
  const basketball_result: GameResult = { ...KARPAT_3_1, home_goals: 90, away_goals: 80 };

  for (const sport of sports) {
    it.each(cases)(`${sport}: %s`, (_label, right_team_picks, other_picks, picked, expected) => {
      const result = sport === "basketball" ? basketball_result : KARPAT_3_1;
      const points = score_pre_game(
        sport,
        pick({ winner_team_id: picked }),
        result,
        crowd(right_team_picks, other_picks),
      );
      expect(points.bold_call).toBe(expected);
    });
  }

  it("gives no bonus without crowd data", () => {
    expect(score_pre_game("hockey", pick({}), KARPAT_3_1, null).bold_call).toBe(0);
  });
});

describe("max_pick_points", () => {
  it("is 50 in hockey and football and 40 in basketball (before the bold call)", () => {
    expect(max_pick_points("hockey")).toBe(50);
    expect(max_pick_points("football")).toBe(50);
    expect(max_pick_points("basketball")).toBe(40);
  });
});
