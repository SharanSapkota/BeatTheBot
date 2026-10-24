import { describe, expect, it } from "vitest";
import {
  compute_input_hash,
  history_before,
  predict_from_season,
  remaining_games,
  to_played_game,
  to_season_data,
} from "./model_inputs";
import {
  KALPA_ID,
  KARPAT_ID,
  model_game_row as game,
  SEASON_ROWS as ROWS,
} from "../../test_helpers/model_rows";

describe("to_played_game", () => {
  it("keeps finished games with a result type and skips the rest", () => {
    expect(to_played_game(game("x", 1, KARPAT_ID, KALPA_ID, [2, 1, "overtime"]))?.ended_in).toBe(
      "overtime",
    );
    expect(to_played_game(game("x", 1, KARPAT_ID, KALPA_ID))).toBeNull();
    expect(to_played_game(game("x", 1, KARPAT_ID, KALPA_ID, [2, 2, "overtime"]))).toBeNull();
    expect(to_played_game(game("x", 1, KARPAT_ID, KALPA_ID, [2, 1, "unknown"]))).toBeNull();
  });
});

describe("season data", () => {
  const data = to_season_data(ROWS);

  it("uses only games that started before the cutoff", () => {
    const history = history_before(data, new Date(Date.UTC(2026, 9, 4, 0, 0)));

    expect(history.map((played) => played.id)).toEqual(["g1", "g2", "g3"]);
    expect(remaining_games(data, history).map((remaining) => remaining.id)).toEqual([
      "g4",
      "g5",
      "g6",
      "g7",
      "next",
      "later",
    ]);
  });

  it("predicts a game from real rows, with a real scorer", () => {
    const next = ROWS.games.find((candidate) => candidate.id === "next");
    if (!next) {
      throw new Error("missing fixture");
    }
    const prediction = predict_from_season(data, next, { stakes_simulations: 200 });

    expect(prediction.predicted_winner_team_id).toBe(KARPAT_ID);
    expect(prediction.scorer?.player_id).toBe("p1");
    expect(prediction.stakes.highlights.length).toBe(2);
  });

  it("changes the input hash only when the inputs change", () => {
    const window = ROWS.games.slice(-2);
    const hash = compute_input_hash(data, window);

    expect(compute_input_hash(to_season_data(ROWS), window)).toBe(hash);
    const corrected = to_season_data({
      ...ROWS,
      goals: [...ROWS.goals.slice(1), { game_id: "g4", team_id: KARPAT_ID, player_id: "p2" }],
    });
    expect(compute_input_hash(corrected, window)).not.toBe(hash);
    expect(compute_input_hash(data, window.slice(0, 1))).not.toBe(hash);
  });
});
