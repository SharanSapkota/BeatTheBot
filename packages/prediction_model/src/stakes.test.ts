import { describe, expect, it } from "vitest";
import { compute_stakes, swing } from "./stakes";
import { compute_team_strengths } from "./team_strength";
import { played, scheduled } from "./test_helpers";

const TEAMS = ["a", "b", "c", "d", "e", "f"];
const RULES = { playoff_spots: 3, top_spots: 2, relegated_team_count: 2 };

describe("compute_stakes", () => {
  // A tight table so one game matters, and a short remaining schedule.
  const played_games = [
    played("p1", 0, "a", "b", 3, 2),
    played("p2", 0, "c", "d", 2, 3),
    played("p3", 0, "e", "f", 1, 1 + 1, "overtime"),
  ];
  const game = scheduled("target", 10, "c", "e");
  const remaining = [game, scheduled("r1", 11, "a", "f"), scheduled("r2", 11, "b", "d")];
  const stakes = compute_stakes(
    {
      team_ids: TEAMS,
      played_games,
      remaining_games: remaining,
      strengths: compute_team_strengths(TEAMS, played_games),
      rules: RULES,
      simulations: 3000,
      seed: 5,
    },
    game,
  );

  it("moves the odds in the right direction for both teams", () => {
    for (const stake of stakes.all) {
      if (stake.kind === "relegation") {
        expect(stake.if_win).toBeLessThanOrEqual(stake.if_loss);
      } else {
        expect(stake.if_win).toBeGreaterThanOrEqual(stake.if_loss);
      }
    }
    const c_playoffs = stakes.all.find(
      (stake) => stake.team_id === "c" && stake.kind === "playoffs",
    );
    expect(c_playoffs && swing(c_playoffs)).toBeGreaterThan(0.1);
  });

  it("highlights the biggest change for each team, biggest first", () => {
    expect(stakes.highlights.map((stake) => stake.team_id).sort()).toEqual(["c", "e"]);
    const swings = stakes.highlights.map(swing);
    expect(swings).toEqual([...swings].sort((first, second) => second - first));
  });

  it("needs the game in the remaining schedule", () => {
    expect(() =>
      compute_stakes(
        {
          team_ids: TEAMS,
          played_games: [],
          remaining_games: [],
          strengths: compute_team_strengths(TEAMS, []),
          rules: RULES,
          simulations: 10,
          seed: 1,
        },
        game,
      ),
    ).toThrow(/not in the remaining games/);
  });
});
