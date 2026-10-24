import type { PredictionRequest } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { pick_rule_error } from "./pick_rules";

const TEAM = "6a6a2f0e-0d1c-4a52-9b2b-2a5e1f0c0001";

function pick(change: Partial<PredictionRequest>): PredictionRequest {
  return {
    predicted_winner_team_id: TEAM,
    predicted_home_goals: 2,
    predicted_away_goals: 1,
    predicted_scorer_id: null,
    predicted_margin_band: null,
    ...change,
  };
}

describe("pick_rule_error", () => {
  // [label, sport, pick change, error or null]
  const cases: [
    string,
    "hockey" | "football" | "basketball",
    Partial<PredictionRequest>,
    string | null,
  ][] = [
    ["hockey: winner + score", "hockey", {}, null],
    [
      "hockey: no draw",
      "hockey",
      { predicted_winner_team_id: null },
      "Pick a winner: this sport has no draws",
    ],
    [
      "hockey: score needed",
      "hockey",
      { predicted_home_goals: null },
      "Pick the exact score (home and away goals)",
    ],
    [
      "hockey: no margin band",
      "hockey",
      { predicted_margin_band: "1_5" },
      "This sport has no winning-margin pick",
    ],
    [
      "football: draw is a pick",
      "football",
      { predicted_winner_team_id: null, predicted_home_goals: 1, predicted_away_goals: 1 },
      null,
    ],
    [
      "football: score needed",
      "football",
      { predicted_away_goals: null },
      "Pick the exact score (home and away goals)",
    ],
    [
      "basketball: winner + band",
      "basketball",
      { predicted_home_goals: null, predicted_away_goals: null, predicted_margin_band: "6_10" },
      null,
    ],
    [
      "basketball: band is optional",
      "basketball",
      { predicted_home_goals: null, predicted_away_goals: null },
      null,
    ],
    ["basketball: no exact score", "basketball", {}, "This sport has no exact-score pick"],
    [
      "basketball: no draw",
      "basketball",
      { predicted_winner_team_id: null, predicted_home_goals: null, predicted_away_goals: null },
      "Pick a winner: this sport has no draws",
    ],
  ];

  it.each(cases)("%s", (_label, sport, change, error) => {
    expect(pick_rule_error(sport, pick(change))).toBe(error);
  });
});
