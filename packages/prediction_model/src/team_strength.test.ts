import { describe, expect, it } from "vitest";
import { compute_team_strengths, regulation_score } from "./team_strength";
import { played, round_robin } from "./test_helpers";

const TEAMS = ["a", "b", "c", "d"];

describe("regulation_score", () => {
  it("removes the overtime winning goal", () => {
    expect(regulation_score(played("g", 0, "a", "b", 3, 2, "overtime"))).toEqual({
      home: 2,
      away: 2,
    });
    expect(regulation_score(played("g", 0, "a", "b", 1, 2, "shootout"))).toEqual({
      home: 1,
      away: 1,
    });
    expect(regulation_score(played("g", 0, "a", "b", 4, 1))).toEqual({ home: 4, away: 1 });
  });
});

describe("compute_team_strengths", () => {
  it("gives every team average strength and the default goals without games", () => {
    const model = compute_team_strengths(TEAMS, []);

    expect(model.league_home_goals).toBe(3.0);
    expect(model.league_away_goals).toBe(2.6);
    for (const strength of model.teams.values()) {
      expect(strength).toEqual({ attack: 1, defence: 1, games: 0 });
    }
  });

  it("rates a team that scores more and lets in less as stronger", () => {
    const games = round_robin(TEAMS, (home, away) => {
      if (home === "a") return [5, 1];
      if (away === "a") return [1, 4];
      return [3, 2];
    });
    const model = compute_team_strengths(TEAMS, games);
    const a = model.teams.get("a");
    const b = model.teams.get("b");

    expect(a?.attack).toBeGreaterThan(1.2);
    expect(a?.defence).toBeLessThan(0.8);
    expect(b?.attack).toBeLessThan(1);
    expect(a?.games).toBe(6);
  });

  it("measures home advantage from the data", () => {
    const games = round_robin(TEAMS, () => [4, 2]);
    const model = compute_team_strengths(TEAMS, games);

    expect(model.home_advantage).toBeGreaterThan(1);
  });

  it("shrinks a team with one big win toward average", () => {
    const model = compute_team_strengths(TEAMS, [played("g1", 0, "a", "b", 9, 0)]);

    expect(model.teams.get("a")?.attack).toBeLessThan(1.6);
    expect(model.teams.get("a")?.attack).toBeGreaterThan(1);
  });

  it("weighs recent games more than old ones", () => {
    const games = [
      // "a" won its old games, "b" its recent ones, by the same margins.
      ...Array.from({ length: 10 }, (_, index) =>
        played(`old_${String(index)}`, index, "a", "c", 5, 1),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        played(`mid_${String(index)}`, 10 + index, "b", "c", 1, 5),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        played(`new_a_${String(index)}`, 20 + index, "a", "d", 1, 5),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        played(`new_b_${String(index)}`, 20 + index, "b", "d", 5, 1),
      ),
    ];
    const model = compute_team_strengths(TEAMS, games);

    expect(model.teams.get("b")?.attack ?? 0).toBeGreaterThan(model.teams.get("a")?.attack ?? 0);
  });
});
