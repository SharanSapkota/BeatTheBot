import { has_scored, score_after_regulation, winner_team_id, type GameResult } from "./game_result";
import { POINTS } from "./points";

/** A before-the-game pick: the user's, or the AI's own pick. */
export interface PreGamePick {
  winner_team_id: string;
  home_goals: number;
  away_goals: number;
  scorer_id: string | null;
}

/** Points per part of a pick for a finished game; 0 = wrong. */
export interface PreGamePoints {
  winner: number;
  exact_score: number;
  scorer: number;
  beat_ai: number;
  total: number;
}

function base_points(pick: PreGamePick, result: GameResult) {
  const regulation = score_after_regulation(result);
  const is_winner_right = pick.winner_team_id === winner_team_id(result);
  return {
    is_winner_right,
    winner: is_winner_right ? POINTS.winner : 0,
    exact_score:
      pick.home_goals === regulation.home && pick.away_goals === regulation.away
        ? POINTS.exact_score
        : 0,
    scorer: has_scored(result, pick.scorer_id) ? POINTS.scorer : 0,
  };
}

/**
 * The user's points for a finished game: winner 10, exact score after 60 min 25, scorer 15,
 * and +5 when the user picked the right winner and the AI did not.
 */
export function score_pre_game(
  pick: PreGamePick,
  result: GameResult,
  ai_pick: PreGamePick | null,
): PreGamePoints {
  const { is_winner_right, winner, exact_score, scorer } = base_points(pick, result);
  const is_ai_wrong = ai_pick !== null && ai_pick.winner_team_id !== winner_team_id(result);
  const beat_ai = is_winner_right && is_ai_wrong ? POINTS.beat_ai : 0;
  return { winner, exact_score, scorer, beat_ai, total: winner + exact_score + scorer + beat_ai };
}

/** The AI's points for its own pick (no bonus: it can't beat itself). */
export function score_ai_pick(ai_pick: PreGamePick, result: GameResult): PreGamePoints {
  const { winner, exact_score, scorer } = base_points(ai_pick, result);
  return { winner, exact_score, scorer, beat_ai: 0, total: winner + exact_score + scorer };
}
