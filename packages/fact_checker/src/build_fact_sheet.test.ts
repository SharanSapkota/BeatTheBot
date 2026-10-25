import { describe, expect, it } from "vitest";
import {
  biggest_change,
  build_fact_sheet,
  format_game_time,
  weekday_of,
  type FactSheetInput,
} from "./build_fact_sheet";

const INPUT: FactSheetInput = {
  game_id: "game-1",
  built_at: "2026-10-24T21:47:00.000Z",
  date: "2026-10-24",
  home_team: "Kärpät",
  away_team: "Ilves",
  home_goals: 3,
  away_goals: 2,
  ended_in: "shootout",
  goals: [
    { player: "Eetu Laine", team: "Kärpät", period: 1, game_time_seconds: 877 },
    { player: null, team: "Ilves", period: 2, game_time_seconds: 1512 },
    { player: "Joonas Niemi", team: "Kärpät", period: 3, game_time_seconds: 3063 },
    { player: "Aleksi Mäkelä", team: "Ilves", period: 3, game_time_seconds: 3500 },
    { player: "Eetu Laine", team: "Kärpät", period: 5, game_time_seconds: 3900 },
  ],
  standings: [
    { team: "Kärpät", rank_before: 13, rank_after: 12, points_before: 25, points_after: 27 },
  ],
  odds: [
    {
      team: "Kärpät",
      before: { relegation: 0.34, playoffs: 0.5, top_4: 0.05 },
      after: { relegation: 0.27, playoffs: 0.58, top_4: 0.06 },
    },
  ],
  odds_source: "prediction_model:poisson_mc_v1",
  next_games: [{ team: "Kärpät", opponent: "Jukurit", venue: "away", date: "2026-10-31" }],
};

describe("build_fact_sheet", () => {
  const sheet = build_fact_sheet(INPUT);

  it("adds lead changes and a comeback when every goal is known", () => {
    const comeback = build_fact_sheet({
      ...INPUT,
      home_goals: 3,
      away_goals: 2,
      goals: [
        { player: "Aleksi Ahola", team: "Ilves", period: 1, game_time_seconds: 300 },
        { player: "Aleksi Ahola", team: "Ilves", period: 1, game_time_seconds: 600 },
        { player: "Eetu Laine", team: "Kärpät", period: 2, game_time_seconds: 1500 },
        { player: "Eetu Laine", team: "Kärpät", period: 2, game_time_seconds: 2000 },
        { player: "Eetu Laine", team: "Kärpät", period: 3, game_time_seconds: 3000 },
      ],
    });
    const lead = comeback.facts.find((fact) => fact.type === "lead_changes");
    expect(lead?.value).toEqual({ lead_changes: 1, comeback: { team: "Kärpät", from_behind: 2 } });
  });

  it("leaves out lead changes when goals are missing", () => {
    const missing = build_fact_sheet({ ...INPUT, goals: INPUT.goals.slice(0, 1) });
    expect(missing.facts.some((fact) => fact.type === "lead_changes")).toBe(false);
  });

  it("marks sample games' facts as sample data", () => {
    const sample = build_fact_sheet({ ...INPUT, data_source: "sample_data" });
    expect(sample.facts[0]?.source).toBe("sample_data");
  });

  it("numbers the facts and gives each a source", () => {
    expect(sheet.facts.map((fact) => [fact.fact_id, fact.type, fact.source])).toEqual([
      ["f1", "final_score", "liiga_api"],
      ["f2", "goal", "liiga_api"],
      ["f3", "goal", "liiga_api"],
      ["f4", "goal", "liiga_api"],
      ["f5", "standing", "derived"],
      ["f6", "season_odds", "prediction_model:poisson_mc_v1"],
      ["f7", "next_game", "liiga_api"],
      ["f8", "lead_changes", "derived"],
    ]);
  });

  it("keeps the running score through goals without a scorer and leaves out shootout goals", () => {
    const goals = sheet.facts.flatMap((fact) => (fact.type === "goal" ? [fact.value] : []));

    expect(goals.map((goal) => [goal.player, goal.game_time, goal.score_after])).toEqual([
      ["Eetu Laine", "14:37", { home: 1, away: 0 }],
      ["Joonas Niemi", "51:03", { home: 2, away: 1 }],
      ["Aleksi Mäkelä", "58:20", { home: 2, away: 2 }],
    ]);
  });

  it("picks the stake the game changed most and adds the next game's weekday", () => {
    expect(sheet.facts[5]?.value).toEqual({
      team: "Kärpät",
      kind: "playoffs",
      before: 0.5,
      after: 0.58,
    });
    expect(sheet.facts[6]?.value).toMatchObject({ opponent: "Jukurit", weekday: "Saturday" });
  });
});

describe("helpers", () => {
  it("formats game time from the start of the game", () => {
    expect(format_game_time(3063)).toBe("51:03");
    expect(format_game_time(65)).toBe("01:05");
  });

  it("names the weekday of a date", () => {
    expect(weekday_of("2026-10-24")).toBe("Saturday");
    expect(weekday_of("2026-10-26")).toBe("Monday");
  });

  it("prefers relegation when changes are equal", () => {
    const flat = { relegation: 0.1, playoffs: 0.1, top_4: 0.1 };
    expect(biggest_change({ team: "X", before: flat, after: flat })).toBe("relegation");
  });
});
