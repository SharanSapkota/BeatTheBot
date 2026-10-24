import type { ModelGameRow, SeasonRows } from "../modules/ai_predictions/model_inputs_repository";

// Model input rows for unit tests with fake repositories.

export const KARPAT_ID = "11111111-1111-4111-8111-111111111111";
export const KALPA_ID = "22222222-2222-4222-8222-222222222222";
const ILVES_ID = "33333333-3333-4333-8333-333333333333";
const MODEL_TEAMS = [
  { id: KARPAT_ID, name: "Kärpät" },
  { id: KALPA_ID, name: "KalPa" },
  { id: ILVES_ID, name: "Ilves" },
];

export function model_game_row(
  id: string,
  day: number,
  home: string,
  away: string,
  result?: [number, number, string],
): ModelGameRow {
  return {
    id,
    season: "2026-27",
    home_team_id: home,
    away_team_id: away,
    start_time: new Date(Date.UTC(2026, 9, day, 15, 30)),
    status: result ? "final" : "scheduled",
    home_goals: result ? result[0] : null,
    away_goals: result ? result[1] : null,
    ended_in: result ? result[2] : null,
  };
}

/** A tiny real-looking season: 7 finished games, then "next" and "later". */
export const SEASON_ROWS: SeasonRows = {
  season: "2026-27",
  teams: MODEL_TEAMS,
  games: [
    model_game_row("g1", 1, KARPAT_ID, KALPA_ID, [4, 1, "regulation"]),
    model_game_row("g2", 2, KALPA_ID, ILVES_ID, [2, 3, "overtime"]),
    model_game_row("g3", 3, ILVES_ID, KARPAT_ID, [1, 2, "regulation"]),
    model_game_row("g4", 4, KARPAT_ID, ILVES_ID, [3, 0, "regulation"]),
    model_game_row("g5", 5, KALPA_ID, KARPAT_ID, [0, 2, "regulation"]),
    model_game_row("g6", 6, ILVES_ID, KALPA_ID, [3, 2, "shootout"]),
    model_game_row("g7", 7, KARPAT_ID, KALPA_ID, [5, 2, "regulation"]),
    model_game_row("next", 10, KARPAT_ID, KALPA_ID),
    model_game_row("later", 12, ILVES_ID, KARPAT_ID),
  ],
  players: [
    {
      id: "p1",
      team_id: KARPAT_ID,
      first_name: "Eetu",
      last_name: "Päkkilä",
      jersey_number: 19,
      position: "forward",
    },
    {
      id: "p2",
      team_id: KARPAT_ID,
      first_name: "Goalie",
      last_name: "One",
      jersey_number: 1,
      position: "goalie",
    },
  ],
  goals: [
    { game_id: "g4", team_id: KARPAT_ID, player_id: "p1" },
    { game_id: "g5", team_id: KARPAT_ID, player_id: "p1" },
    { game_id: "g7", team_id: KARPAT_ID, player_id: "p1" },
  ],
};
