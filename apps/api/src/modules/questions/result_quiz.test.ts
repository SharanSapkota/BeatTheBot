import { build_fact_sheet, check_claims, type KnownName } from "@voita_kone/fact_checker";
import { describe, expect, it } from "vitest";
import { build_result_quiz, checked_texts } from "./result_quiz";

const SHEET = build_fact_sheet({
  game_id: "game-1",
  built_at: "2026-10-24T20:00:00.000Z",
  date: "2026-10-24",
  home_team: "Kärpät",
  away_team: "KalPa",
  home_goals: 3,
  away_goals: 2,
  ended_in: "regulation",
  goals: [
    { player: "Eetu Laine", team: "Kärpät", period: 1, game_time_seconds: 877 },
    { player: "Aleksi Mäkelä", team: "KalPa", period: 2, game_time_seconds: 1500 },
    { player: "Joonas Niemi", team: "Kärpät", period: 2, game_time_seconds: 2100 },
    { player: "Aleksi Mäkelä", team: "KalPa", period: 3, game_time_seconds: 3000 },
    { player: "Eetu Laine", team: "Kärpät", period: 3, game_time_seconds: 3400 },
  ],
  standings: [
    { team: "Kärpät", rank_before: 7, rank_after: 5, points_before: 20, points_after: 23 },
  ],
  odds: [
    {
      team: "Kärpät",
      before: { playoffs: 0.71, top_4: 0.2, relegation: 0.12 },
      after: { playoffs: 0.8, top_4: 0.26, relegation: 0.07 },
    },
  ],
  odds_source: "prediction_model:test",
  next_games: [],
});

const ROSTER = ["Eetu Laine", "Joonas Niemi", "Ville Koskinen", "Teemu Pulkkinen", "Aleksi Mäkelä"];
const KNOWN_NAMES: KnownName[] = [
  { name: "Kärpät", kind: "team" },
  { name: "KalPa", kind: "team" },
  ...ROSTER.map((name) => ({ name, kind: "player" as const })),
];

describe("build_result_quiz", () => {
  const quiz = build_result_quiz({ sheet: SHEET, roster_names: ROSTER, team_count: 17 });

  it("builds 3 questions with 4 different options and the fact as the right answer", () => {
    expect(quiz.map((question) => question.prompt)).toEqual([
      "Who scored the first goal of the game?",
      "After this game, what is Kärpät's chance of making the playoffs?",
      "Where is Kärpät in the table after this game?",
    ]);
    for (const question of quiz) {
      expect(new Set(question.options.map((option) => option.label)).size).toBe(4);
    }
    const right_label = (index: number) => {
      const question = quiz[index];
      return question?.options.find((option) => option.id === question.correct_option)?.label;
    };
    expect(right_label(0)).toBe("Eetu Laine");
    expect(right_label(1)).toBe("80%");
    expect(right_label(2)).toBe("5th");
  });

  it("uses plausible wrong options: other scorers, the odds before, nearby places", () => {
    const labels = quiz.map((question) => question.options.map((option) => option.label));
    expect(labels[0]).toEqual(expect.arrayContaining(["Aleksi Mäkelä", "Joonas Niemi"]));
    expect(labels[1]).toContain("71%");
    expect(labels[2]).toContain("7th");
  });

  it("passes the fact checker with every text it shows", () => {
    for (const question of quiz) {
      for (const text of checked_texts(question)) {
        expect(check_claims(text, SHEET, KNOWN_NAMES).failed_claims).toEqual([]);
      }
    }
  });

  it("is the same on every run", () => {
    expect(build_result_quiz({ sheet: SHEET, roster_names: ROSTER, team_count: 17 })).toEqual(quiz);
  });

  it("falls back to the final score when there are no season facts", () => {
    const basic = {
      ...SHEET,
      facts: SHEET.facts.filter((fact) => fact.type !== "season_odds" && fact.type !== "standing"),
    };
    const prompts = build_result_quiz({ sheet: basic, roster_names: ROSTER, team_count: 17 }).map(
      (question) => question.prompt,
    );
    expect(prompts).toEqual([
      "Who scored the first goal of the game?",
      "What was the final score of Kärpät vs KalPa?",
    ]);
  });
});
