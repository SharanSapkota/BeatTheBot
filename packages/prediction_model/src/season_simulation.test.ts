import { describe, expect, it } from "vitest";
import { mulberry32 } from "./rng";
import { simulate_season, type SimulationInput } from "./season_simulation";
import { compute_team_strengths } from "./team_strength";
import { played, scheduled } from "./test_helpers";

const TEAMS = ["a", "b", "c", "d", "e", "f"];
const RULES = { playoff_spots: 4, top_spots: 2, relegated_team_count: 1 };

function remaining_round(): ReturnType<typeof scheduled>[] {
  const games = [];
  let index = 0;
  for (const home of TEAMS) {
    for (const away of TEAMS) {
      if (home !== away) {
        games.push(scheduled(`r_${home}_${away}`, 100 + index, home, away));
        index += 1;
      }
    }
  }
  return games;
}

function input(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    team_ids: TEAMS,
    played_games: [],
    remaining_games: remaining_round(),
    strengths: compute_team_strengths(TEAMS, []),
    rules: RULES,
    simulations: 2000,
    seed: 42,
    ...overrides,
  };
}

describe("mulberry32", () => {
  it("repeats the same numbers for the same seed, in [0, 1)", () => {
    const first = mulberry32(7);
    const second = mulberry32(7);
    const values = Array.from({ length: 100 }, () => first());

    expect(values).toEqual(Array.from({ length: 100 }, () => second()));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("simulate_season", () => {
  it("is deterministic with a seed", () => {
    expect(simulate_season(input())).toEqual(simulate_season(input()));
    expect(simulate_season(input({ seed: 43 }))).not.toEqual(simulate_season(input()));
  });

  it("hands out exactly the playoff, top and relegation spots", () => {
    const odds = simulate_season(input());
    const sum = (
      field: "playoff_probability" | "top_spots_probability" | "relegation_probability",
    ) => odds.reduce((total, row) => total + row[field], 0);

    expect(sum("playoff_probability")).toBeCloseTo(4, 6);
    expect(sum("top_spots_probability")).toBeCloseTo(2, 6);
    expect(sum("relegation_probability")).toBeCloseTo(1, 6);
  });

  it("starts from the points already won", () => {
    // Every team has beaten "f" 20 times; 6 games left can't save "f".
    const played_games = ["a", "b", "c", "d", "e"].flatMap((team_id) =>
      Array.from({ length: 20 }, (_, index) =>
        played(`${team_id}_${String(index)}`, index, team_id, "f", 5, 0),
      ),
    );
    const odds = simulate_season(
      input({ played_games, remaining_games: remaining_round().slice(0, 6) }),
    );
    const f = odds.find((row) => row.team_id === "f");

    expect(f?.relegation_probability).toBe(1);
    expect(f?.playoff_probability).toBe(0);
    expect(odds.find((row) => row.team_id === "a")?.expected_points).toBeGreaterThan(60);
  });

  it("throws for a game with an unknown team", () => {
    expect(() =>
      simulate_season(input({ remaining_games: [scheduled("x", 1, "a", "zz")] })),
    ).toThrow(/unknown team/);
  });
});
