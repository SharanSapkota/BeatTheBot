import { describe, expect, it } from "vitest";
import type { GameResult } from "./game_result";
import { score_ai_pick, score_pre_game, type PreGamePick } from "./pre_game";

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
  return { winner_team_id: HOME, home_goals: 3, away_goals: 2, scorer_id: "laine", ...change };
}

describe("score_pre_game", () => {
  it("gives winner + scorer points and 0 for a wrong exact score", () => {
    expect(score_pre_game(pick({}), KARPAT_3_1, pick({}))).toEqual({
      winner: 10,
      exact_score: 0,
      scorer: 15,
      beat_ai: 0,
      total: 25,
    });
  });

  it("gives all points for a perfect pick", () => {
    expect(score_pre_game(pick({ away_goals: 1 }), KARPAT_3_1, null).total).toBe(50);
  });

  it("adds +5 only when the user is right and the AI picked the other winner", () => {
    const ai_wrong = pick({ winner_team_id: AWAY });

    expect(score_pre_game(pick({}), KARPAT_3_1, ai_wrong).beat_ai).toBe(5);
    expect(score_pre_game(pick({ winner_team_id: AWAY }), KARPAT_3_1, ai_wrong).beat_ai).toBe(0);
  });

  it("gives 0 for a wrong winner and a scorer who didn't score", () => {
    const points = score_pre_game(
      pick({ winner_team_id: AWAY, scorer_id: "koskinen" }),
      KARPAT_3_1,
      null,
    );

    expect(points).toEqual({ winner: 0, exact_score: 0, scorer: 0, beat_ai: 0, total: 0 });
  });
});

describe("score_ai_pick", () => {
  it("scores the AI's own pick without a bonus", () => {
    expect(score_ai_pick(pick({ scorer_id: "niemi" }), KARPAT_3_1)).toEqual({
      winner: 10,
      exact_score: 0,
      scorer: 15,
      beat_ai: 0,
      total: 25,
    });
  });
});
