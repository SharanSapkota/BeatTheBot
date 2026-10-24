import type { FactSheet, KnownName } from "./fact_sheet";

// The design's example game: Kärpät beat Ilves 3–1 at home on Sat 24 Oct 2026.
export const SHEET: FactSheet = {
  game_id: "game-1",
  built_at: "2026-10-24T21:47:00.000Z",
  facts: [
    {
      fact_id: "f1",
      type: "final_score",
      value: {
        home_team: "Kärpät",
        away_team: "Ilves",
        home_goals: 3,
        away_goals: 1,
        ended_in: "regulation",
        date: "2026-10-24",
      },
      source: "liiga_api",
    },
    {
      fact_id: "f2",
      type: "goal",
      value: {
        player: "Eetu Laine",
        team: "Kärpät",
        period: 1,
        game_time: "14:37",
        score_after: { home: 1, away: 0 },
      },
      source: "liiga_api",
    },
    {
      fact_id: "f3",
      type: "goal",
      value: {
        player: "Aleksi Mäkelä",
        team: "Ilves",
        period: 2,
        game_time: "25:12",
        score_after: { home: 1, away: 1 },
      },
      source: "liiga_api",
    },
    {
      fact_id: "f4",
      type: "goal",
      value: {
        player: "Eetu Laine",
        team: "Kärpät",
        period: 3,
        game_time: "51:03",
        score_after: { home: 3, away: 1 },
      },
      source: "liiga_api",
    },
    {
      fact_id: "f5",
      type: "standing",
      value: {
        team: "Kärpät",
        rank_before: 13,
        rank_after: 12,
        points_before: 25,
        points_after: 28,
      },
      source: "derived",
    },
    {
      fact_id: "f6",
      type: "season_odds",
      value: { team: "Kärpät", kind: "relegation", before: 0.34, after: 0.268 },
      source: "prediction_model:poisson_mc_v1",
    },
    {
      fact_id: "f7",
      type: "next_game",
      value: {
        team: "Kärpät",
        opponent: "Jukurit",
        venue: "away",
        date: "2026-10-31",
        weekday: "Saturday",
      },
      source: "liiga_api",
    },
  ],
};

export const KNOWN_NAMES: KnownName[] = [
  { name: "Kärpät", kind: "team", aliases: ["Oulun Kärpät", "Kärppien"] },
  { name: "Ilves", kind: "team" },
  { name: "Jukurit", kind: "team" },
  { name: "Tappara", kind: "team" },
  { name: "Eetu Laine", kind: "player" },
  { name: "Aleksi Mäkelä", kind: "player" },
  { name: "Joonas Niemi", kind: "player" },
];
