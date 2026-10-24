import {
  build_fact_sheet,
  build_preview_fact_sheet,
  type FactSheet,
  type KnownName,
} from "@voita_kone/fact_checker";

// Fact sheets for story tests: Kärpät beat Ilves 3–1 (summary) and Kärpät–Ilves to come (preview).

export const SUMMARY_SHEET: FactSheet = build_fact_sheet({
  game_id: "game-1",
  built_at: "2026-10-24T20:00:00.000Z",
  date: "2026-10-24",
  home_team: "Kärpät",
  away_team: "Ilves",
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
  goals: [
    { player: "Eetu Laine", team: "Kärpät", period: 1, game_time_seconds: 877 },
    { player: "Aleksi Mäkelä", team: "Ilves", period: 2, game_time_seconds: 1512 },
    { player: "Joonas Niemi", team: "Kärpät", period: 2, game_time_seconds: 2300 },
    { player: "Eetu Laine", team: "Kärpät", period: 3, game_time_seconds: 3063 },
  ],
  standings: [
    { team: "Kärpät", rank_before: 13, rank_after: 12, points_before: 25, points_after: 28 },
  ],
  odds: [
    {
      team: "Kärpät",
      before: { playoffs: 0.5, top_4: 0.05, relegation: 0.34 },
      after: { playoffs: 0.55, top_4: 0.06, relegation: 0.27 },
    },
  ],
  odds_source: "prediction_model:test",
  next_games: [{ team: "Kärpät", opponent: "Jukurit", venue: "away", date: "2026-10-31" }],
});

export const PREVIEW_SHEET: FactSheet = build_preview_fact_sheet({
  game_id: "game-2",
  built_at: "2026-10-24T10:00:00.000Z",
  home: {
    team: "Kärpät",
    form: "WWLWL",
    venue_record: { wins: 4, losses: 2 },
    table: { rank: 12, points: 28, games_played: 14 },
    top_scorer: { player: "Eetu Laine", goals: 4 },
    stake: { kind: "relegation", if_win: 0.21, if_loss: 0.33 },
  },
  away: {
    team: "Ilves",
    form: "LLWLL",
    venue_record: { wins: 2, losses: 5 },
    table: { rank: 15, points: 17, games_played: 14 },
    top_scorer: { player: "Aleksi Mäkelä", goals: 3 },
    stake: null,
  },
  meetings: [
    {
      home_team: "Kärpät",
      away_team: "Ilves",
      date: "2026-10-24",
      home_goals: 3,
      away_goals: 1,
      ended_in: "regulation",
    },
  ],
  win_chance: { home_win: 0.62, away_win: 0.38 },
  model_source: "prediction_model:test",
});

export const KNOWN_NAMES: KnownName[] = [
  { name: "Kärpät", kind: "team" },
  { name: "Ilves", kind: "team" },
  { name: "Jukurit", kind: "team" },
  { name: "Tappara", kind: "team" },
  { name: "Eetu Laine", kind: "player" },
  { name: "Aleksi Mäkelä", kind: "player" },
  { name: "Joonas Niemi", kind: "player" },
  { name: "Ville Koskinen", kind: "player" },
];

/** A correct AI summary with fact ids (about 80 words). */
export const GOOD_SUMMARY =
  "Kärpät beat Ilves 3–1 at home [f1]. Eetu Laine opened the scoring at 14:37 [f2]. " +
  "Aleksi Mäkelä made it level for Ilves at 25:12 [f3]. Joonas Niemi scored the winning goal at 38:20 [f6]. " +
  "Laine added one more at 51:03 [f5]. The win moves Kärpät from 13th to 12th place with 28 points [f7]. " +
  "Their chance of relegation fell from 34% to 27% [f8]. Next up, Kärpät play Jukurit away on Saturday [f9]. " +
  "It was a good night for the home crowd.";
