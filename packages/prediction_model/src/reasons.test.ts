import { describe, expect, it } from "vitest";
import { all_reasons, build_reasons, type ReasonInput } from "./reasons";
import { played } from "./test_helpers";

const TEAMS = ["a", "b", "c", "d"];
const HOME = { id: "a", name: "Kärpät" };
const AWAY = { id: "b", name: "Ilves" };

// Kärpät win at home, Ilves lose away; both beat the others sometimes.
const HISTORY = [
  played("h1", 0, "a", "c", 4, 1),
  played("h2", 1, "c", "b", 4, 2),
  played("h3", 2, "a", "d", 5, 2),
  played("h4", 3, "d", "b", 3, 1),
  played("h5", 4, "a", "b", 5, 2),
  played("h6", 5, "b", "c", 4, 3),
  played("h7", 6, "c", "a", 1, 3),
  played("h8", 7, "b", "d", 3, 2),
  played("h9", 8, "a", "c", 3, 2, "overtime"),
  played("h10", 9, "c", "b", 3, 1),
  played("h11", 10, "d", "a", 2, 4),
  played("h12", 11, "d", "c", 2, 2 + 1, "shootout"),
];

function input(overrides: Partial<ReasonInput> = {}): ReasonInput {
  return {
    home_team: HOME,
    away_team: AWAY,
    predicted_winner_team_id: "a",
    team_ids: TEAMS,
    history: HISTORY,
    scorer: {
      player_id: "p1",
      team_id: "a",
      recent_goals: 4,
      recent_games: 5,
      goals_per_game: 0.8,
      season_goals: 6,
    },
    scorer_name: "Eetu Laine",
    ...overrides,
  };
}

describe("build_reasons", () => {
  it("returns up to 3 reasons that support the pick, one per type", () => {
    const reasons = build_reasons(input());

    expect(reasons.length).toBe(3);
    expect(reasons.every((reason) => reason.favours_team_id === "a")).toBe(true);
    expect(new Set(reasons.map((reason) => reason.type)).size).toBe(reasons.length);
    const relevances = reasons.map((reason) => reason.relevance);
    expect(relevances).toEqual([...relevances].sort((first, second) => second - first));
  });

  it("computes the facts from the input games", () => {
    const home_record = all_reasons(input()).find(
      (reason) => reason.fact_id === "venue_record:home:a",
    );

    // Kärpät home games h1, h3, h5, h9: all won.
    expect(home_record?.values).toEqual({ team: "Kärpät", venue: "home", wins: 4, games: 4 });
    expect(home_record?.text_en).toBe("Kärpät won 4 of their last 4 home games.");
    const away_record = all_reasons(input()).find(
      (reason) => reason.fact_id === "venue_record:away:b",
    );
    // Ilves away games h2, h4, h5, h10: all lost.
    expect(away_record?.text_en).toBe("Ilves won only 0 of their last 4 away games.");
    expect(away_record?.favours_team_id).toBe("a");
  });

  it("only writes numbers that are in the fact values", () => {
    const numbers_in = (text: string) => (text.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    for (const reason of all_reasons(input())) {
      const fact_numbers = Object.values(reason.values).flatMap((value) =>
        typeof value === "number" ? [value] : numbers_in(value),
      );
      for (const number of numbers_in(reason.text_en)) {
        expect(fact_numbers, `${reason.fact_id}: ${String(number)}`).toContain(number);
      }
    }
  });

  it("gives no reasons without data", () => {
    expect(build_reasons(input({ history: [], scorer: null, scorer_name: null }))).toEqual([]);
  });

  it("names the scorer only with enough recent goals", () => {
    const quiet = input({
      scorer: {
        player_id: "p1",
        team_id: "a",
        recent_goals: 1,
        recent_games: 5,
        goals_per_game: 0.2,
        season_goals: 2,
      },
    });

    expect(all_reasons(quiet).some((reason) => reason.type === "scorer_form")).toBe(false);
    expect(all_reasons(input()).find((reason) => reason.type === "scorer_form")?.text_en).toBe(
      "Eetu Laine has 4 goals in Kärpät's last 5 games.",
    );
  });
});
