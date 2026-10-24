import type { PredictionRequest } from "@voita_kone/shared_types";
import { SPORTS, has_pick, type SportId } from "@voita_kone/scoring";

/**
 * Why a pick does not fit the sport's picks (`SPORTS[sport].picks`), or null when it does.
 * - a draw (no winner) only where a draw is possible (football)
 * - both goals with an exact-score pick, none without one (basketball)
 * - a margin band only in basketball
 */
export function pick_rule_error(sport: SportId, pick: PredictionRequest): string | null {
  if (pick.predicted_winner_team_id === null && !SPORTS[sport].allows_draw) {
    return "Pick a winner: this sport has no draws";
  }
  const goals = [pick.predicted_home_goals, pick.predicted_away_goals];
  if (has_pick(sport, "exact_score") && goals.some((value) => value === null)) {
    return "Pick the exact score (home and away goals)";
  }
  if (!has_pick(sport, "exact_score") && goals.some((value) => value !== null)) {
    return "This sport has no exact-score pick";
  }
  if (!has_pick(sport, "margin_band") && pick.predicted_margin_band !== null) {
    return "This sport has no winning-margin pick";
  }
  return null;
}
