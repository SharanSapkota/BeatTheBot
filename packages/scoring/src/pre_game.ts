import { has_scored, score_after_regulation, winner_team_id, type GameResult } from "./game_result";
import { POINTS } from "./points";
import {
  SPORTS,
  has_pick,
  margin_band_of,
  pick_points,
  type MarginBand,
  type SportId,
} from "./sports";

/**
 * The user's before-the-game pick. Which parts count depends on the sport (`SPORTS[sport].picks`);
 * the others are ignored.
 */
export interface PreGamePick {
  /** The picked winner; null = a draw (football only). */
  winner_team_id: string | null;
  /** Exact score (hockey, football); null when not picked. */
  home_goals: number | null;
  away_goals: number | null;
  /** Hockey / football: a scorer. Basketball: the top scorer. */
  scorer_id: string | null;
  /** Basketball: the winner's margin. */
  margin_band: MarginBand | null;
}

/** Crowd key of a draw pick in `CrowdSplit.picks_by_team`. */
export const DRAW_KEY = "draw";

/** How all fans picked the outcome, at lock time (puck drop / kick-off). */
export interface CrowdSplit {
  total_picks: number;
  /** Picks per team id, plus `DRAW_KEY` for draws. */
  picks_by_team: Readonly<Record<string, number>>;
}

/** Points per part of a pick for a finished game; 0 = wrong or not a pick of this sport. */
export interface PreGamePoints {
  /** Winner (hockey, basketball) or 1X2 outcome (football). */
  winner: number;
  exact_score: number;
  scorer: number;
  margin_band: number;
  top_scorer: number;
  bold_call: number;
  total: number;
}

/** A bold call needs this many fan picks, so a handful of picks can't make one. */
export const BOLD_CALL_MIN_PICKS = 20;
/** …and fewer than this share of the fans on the user's (right) outcome. */
export const BOLD_CALL_MAX_SHARE = 0.3;

/** The crowd key of a picked outcome: the team id, or `DRAW_KEY`. */
export function outcome_key(winner_team_id: string | null): string {
  return winner_team_id ?? DRAW_KEY;
}

/** True when fewer than 30% of at least 20 fans picked this outcome (team id or `DRAW_KEY`). */
export function is_bold_pick(crowd: CrowdSplit | null, key: string): boolean {
  if (crowd === null || crowd.total_picks < BOLD_CALL_MIN_PICKS) {
    return false;
  }
  return (crowd.picks_by_team[key] ?? 0) / crowd.total_picks < BOLD_CALL_MAX_SHARE;
}

function points_if(is_right: boolean, points: number): number {
  return is_right ? points : 0;
}

/**
 * The user's points for a finished game, by the sport's picks:
 * - hockey: winner 10, exact score after 60 min 25, scorer 15
 * - football: 1X2 10, exact score after 90 min 25, scorer (first or any goal) 15
 * - basketball: winner 10, winning margin band 15, top scorer 15
 * All sports: +5 bold call when the winner (outcome) is right and fewer than 30% of the fans
 * picked it (at least 20 picks).
 */
export function score_pre_game(
  sport: SportId,
  pick: PreGamePick,
  result: GameResult,
  crowd: CrowdSplit | null,
): PreGamePoints {
  const config = SPORTS[sport];
  const actual_winner = winner_team_id(result);
  // A draw pick (null) is only a pick where a draw is possible.
  const has_outcome = pick.winner_team_id !== null || config.allows_draw;
  const is_winner_right = has_outcome && pick.winner_team_id === actual_winner;
  const winner = points_if(
    is_winner_right,
    pick_points(sport, "winner") + pick_points(sport, "outcome_1x2"),
  );

  let exact_score = 0;
  if (has_pick(sport, "exact_score") && pick.home_goals !== null && pick.away_goals !== null) {
    const regulation = score_after_regulation(result, config.regulation_periods);
    exact_score = points_if(
      pick.home_goals === regulation.home && pick.away_goals === regulation.away,
      pick_points(sport, "exact_score"),
    );
  }
  const scorer = points_if(
    has_pick(sport, "scorer") && has_scored(result, pick.scorer_id),
    pick_points(sport, "scorer"),
  );
  const margin_band = points_if(
    is_winner_right &&
      pick.margin_band !== null &&
      pick.margin_band === margin_band_of(result.home_goals - result.away_goals),
    pick_points(sport, "margin_band"),
  );
  const top_scorer = points_if(
    pick.scorer_id !== null && pick.scorer_id === (result.top_scorer_id ?? null),
    pick_points(sport, "top_scorer"),
  );
  const bold_call = points_if(
    is_winner_right && is_bold_pick(crowd, outcome_key(pick.winner_team_id)),
    POINTS.bold_call,
  );
  return {
    winner,
    exact_score,
    scorer,
    margin_band,
    top_scorer,
    bold_call,
    total: winner + exact_score + scorer + margin_band + top_scorer + bold_call,
  };
}

/** The most a full pick can earn in this sport, before the bold call. */
export function max_pick_points(sport: SportId): number {
  return SPORTS[sport].picks.reduce((total, pick) => total + pick.points, 0);
}
