import { describe, expect, it } from "vitest";
import { build_preview_fact_sheet, type PreviewTeamFacts } from "./build_preview_fact_sheet";
import { build_fact_sheet, find_winning_goal } from "./build_fact_sheet";

const KARPAT: PreviewTeamFacts = {
  team: "Kärpät",
  form: "WWLWL",
  venue_record: { wins: 4, losses: 2 },
  table: { rank: 5, points: 23, games_played: 12 },
  top_scorer: { player: "Eetu Laine", goals: 4 },
  stake: { kind: "playoffs", if_win: 0.8, if_loss: 0.66 },
};
const ILVES: PreviewTeamFacts = {
  team: "Ilves",
  form: "LLLWL",
  venue_record: { wins: 1, losses: 5 },
  table: { rank: 14, points: 12, games_played: 12 },
  top_scorer: null,
  stake: null,
};

describe("build_preview_fact_sheet", () => {
  it("builds form, records, scorer, table, win chance, stakes and meetings with ids", () => {
    const sheet = build_preview_fact_sheet({
      game_id: "g1",
      built_at: "2026-10-24T10:00:00.000Z",
      home: KARPAT,
      away: ILVES,
      meetings: [
        {
          home_team: "Ilves",
          away_team: "Kärpät",
          date: "2026-02-01",
          home_goals: 2,
          away_goals: 4,
          ended_in: "regulation",
        },
      ],
      win_chance: { home_win: 0.62, away_win: 0.38 },
      model_source: "prediction_model:test",
    });

    expect(sheet.kind).toBe("preview");
    expect(sheet.facts.map((fact) => fact.type)).toEqual([
      "win_chance",
      "form",
      "home_away_record",
      "player_form",
      "table_position",
      "stake",
      "form",
      "home_away_record",
      "table_position",
      "head_to_head",
    ]);
    expect(sheet.facts.map((fact) => fact.fact_id).at(-1)).toBe("f10");
    expect(sheet.facts[1]?.value).toMatchObject({ wins: 3, losses: 2, games: 5 });
  });
});

describe("find_winning_goal", () => {
  const goals = [
    { player: "A", team: "Kärpät", period: 1, game_time_seconds: 100 },
    { player: "B", team: "Ilves", period: 2, game_time_seconds: 200 },
    { player: "C", team: "Kärpät", period: 2, game_time_seconds: 300 },
    { player: "D", team: "Kärpät", period: 3, game_time_seconds: 400 },
  ];
  const result = {
    home_team: "Kärpät",
    home_goals: 3,
    away_goals: 1,
    ended_in: "regulation" as const,
  };

  it("is the winner's goal one past the loser's total", () => {
    expect(find_winning_goal(result, goals)?.player).toBe("C");
  });

  it("is none after a shootout", () => {
    expect(find_winning_goal({ ...result, ended_in: "shootout" }, goals)).toBeUndefined();
  });

  it("is a fact in the summary sheet", () => {
    const sheet = build_fact_sheet({
      game_id: "g1",
      built_at: "2026-10-24T21:00:00.000Z",
      date: "2026-10-24",
      home_team: "Kärpät",
      away_team: "Ilves",
      home_goals: 3,
      away_goals: 1,
      ended_in: "regulation",
      goals,
      standings: [],
      odds: [],
      odds_source: "derived",
      next_games: [],
    });
    expect(sheet.facts.find((fact) => fact.type === "winning_goal")?.value).toEqual({
      player: "C",
      team: "Kärpät",
      game_time: "05:00",
    });
  });
});
