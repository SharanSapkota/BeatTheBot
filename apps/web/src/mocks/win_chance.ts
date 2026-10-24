import type { DataSays, GameDetail, WinChance, WinChancePoint } from "@voita_kone/shared_types";
import { goals_of, round_to } from "./sample_utils";

// A home goal moves the home win chance a quarter of the way to 100%, an away goal a quarter
// of the way to 0%. From the design's 62%: 1-0 -> 71%, 1-1 -> 54%.
const GOAL_SHIFT = 0.25;

/** model_version of sample data; the chart says "sample data" when it sees it. */
export const SAMPLE_MODEL_VERSION = "sample";

// Only used when GET /games/:game_id/win_chance fails (see get_or_sample).
export function build_sample_win_chance(game: GameDetail, data_says: DataSays): WinChance {
  let home_win_probability = data_says.home_win_probability;
  const score = { home_goals: 0, away_goals: 0 };
  const points: WinChancePoint[] = [
    { kind: "start", game_time_seconds: 0, ...score, home_win_probability },
  ];

  for (const goal of goals_of(game)) {
    if (goal.team_id === game.home_team.id) {
      score.home_goals += 1;
      home_win_probability += (1 - home_win_probability) * GOAL_SHIFT;
    } else {
      score.away_goals += 1;
      home_win_probability -= home_win_probability * GOAL_SHIFT;
    }
    points.push({
      kind: "goal",
      game_time_seconds: goal.game_time_seconds,
      ...score,
      home_win_probability: round_to(home_win_probability, 0.01),
    });
  }
  return {
    game_id: game.id,
    state: game.state,
    points,
    model_version: SAMPLE_MODEL_VERSION,
    updated_at: new Date().toISOString(),
  };
}
