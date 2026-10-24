import { describe, expect, it } from "vitest";
import { SPORTS, SPORT_IDS, has_pick, margin_band_of, pick_points, sport_config } from "./sports";

describe("SPORTS", () => {
  it("has one config entry per sport id", () => {
    expect(Object.keys(SPORTS).sort()).toEqual([...SPORT_IDS].sort());
    for (const sport of SPORT_IDS) {
      expect(SPORTS[sport].id).toBe(sport);
    }
  });

  // [sport, pick kinds in screen order, points]
  const cases: [string, string[], number[]][] = [
    ["hockey", ["winner", "exact_score", "scorer"], [10, 25, 15]],
    ["football", ["outcome_1x2", "exact_score", "scorer"], [10, 25, 15]],
    ["basketball", ["winner", "margin_band", "top_scorer"], [10, 15, 15]],
  ];
  it.each(cases)("%s picks", (sport, kinds, points) => {
    const config = sport_config(sport);
    expect(config.picks.map((pick) => pick.kind)).toEqual(kinds);
    expect(config.picks.map((pick) => pick.points)).toEqual(points);
  });

  it("only football allows a draw; only hockey has the model", () => {
    expect(SPORT_IDS.filter((sport) => SPORTS[sport].allows_draw)).toEqual(["football"]);
    expect(SPORT_IDS.filter((sport) => SPORTS[sport].has_model)).toEqual(["hockey"]);
  });

  it("answers 0 points for a pick the sport doesn't have", () => {
    expect(pick_points("hockey", "margin_band")).toBe(0);
    expect(has_pick("basketball", "exact_score")).toBe(false);
  });

  it("throws for an unknown sport", () => {
    expect(() => sport_config("curling")).toThrow('Unknown sport "curling"');
  });
});

describe("margin_band_of", () => {
  const cases: [number, string | null][] = [
    [0, null],
    [1, "1_5"],
    [5, "1_5"],
    [-5, "1_5"],
    [6, "6_10"],
    [10, "6_10"],
    [11, "11_plus"],
    [-31, "11_plus"],
  ];
  it.each(cases)("margin %i → %s", (margin, band) => {
    expect(margin_band_of(margin)).toBe(band);
  });
});
