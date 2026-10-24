import { build_fact_sheet, type FactSheet, type KnownName } from "@voita_kone/fact_checker";

// The design's example: Kärpät beat Ilves 3–1 at home; relegation risk 34% → 27%.
export const STORY_SHEET: FactSheet = build_fact_sheet({
  game_id: "22222222-2222-4222-8222-222222222222",
  built_at: "2026-10-24T19:30:00.000Z",
  date: "2026-10-24",
  home_team: "Kärpät",
  away_team: "Ilves",
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
  goals: [
    { player: "Eetu Laine", team: "Kärpät", period: 1, game_time_seconds: 877 },
    { player: "Aleksi Mäkelä", team: "Ilves", period: 2, game_time_seconds: 1512 },
    { player: "Joonas Niemi", team: "Kärpät", period: 2, game_time_seconds: 2100 },
    { player: "Eetu Laine", team: "Kärpät", period: 3, game_time_seconds: 3063 },
  ],
  standings: [
    { team: "Kärpät", rank_before: 13, rank_after: 12, points_before: 25, points_after: 28 },
    { team: "Ilves", rank_before: 5, rank_after: 5, points_before: 33, points_after: 33 },
  ],
  odds: [
    {
      team: "Kärpät",
      before: { relegation: 0.34, playoffs: 0.4, top_4: 0.02 },
      after: { relegation: 0.268, playoffs: 0.46, top_4: 0.03 },
    },
    {
      team: "Ilves",
      before: { relegation: 0.02, playoffs: 0.9, top_4: 0.48 },
      after: { relegation: 0.03, playoffs: 0.88, top_4: 0.42 },
    },
  ],
  odds_source: "prediction_model:poisson_mc_v1",
  next_games: [{ team: "Kärpät", opponent: "Jukurit", venue: "away", date: "2026-10-31" }],
});

export const STORY_NAMES: KnownName[] = [
  { name: "Kärpät", kind: "team" },
  { name: "Ilves", kind: "team" },
  { name: "Jukurit", kind: "team" },
  { name: "Tappara", kind: "team" },
  { name: "Eetu Laine", kind: "player" },
  { name: "Aleksi Mäkelä", kind: "player" },
  { name: "Joonas Niemi", kind: "player" },
  { name: "Ville Koskinen", kind: "player" },
];
