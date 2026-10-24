import type { AiPrediction, GameDetail, WinChance } from "@voita_kone/shared_types";
import { format_compact_score } from "../lib/format";
import { goals_of, round_to } from "./sample_utils";

// A home goal moves the home win chance a quarter of the way to 100%, an away goal a quarter
// of the way to 0%. From the design's 62%: 1-0 -> 71%, 1-1 -> 54%.
const GOAL_SHIFT = 0.25;

// TODO(step 3): replace with GET /api/v1/games/:game_id/win_chance (live model).
export function build_sample_win_chance(game: GameDetail, prediction: AiPrediction): WinChance {
  let home_win_probability = prediction.home_win_probability;
  const score = { home: 0, away: 0 };
  const points = [{ label: "Start", home_win_probability }];

  for (const goal of goals_of(game)) {
    if (goal.team_id === game.home_team.id) {
      score.home += 1;
      home_win_probability += (1 - home_win_probability) * GOAL_SHIFT;
    } else {
      score.away += 1;
      home_win_probability -= home_win_probability * GOAL_SHIFT;
    }
    points.push({
      label: format_compact_score(score.home, score.away),
      home_win_probability: round_to(home_win_probability, 0.01),
    });
  }
  return { points, updated_at: new Date().toISOString() };
}
