// Sport categories and their before-the-game picks. One entry per sport: adding a sport (e.g.
// floorball) = one entry here + the sport CHECK in a migration. Pure, shared by the API and the app.

import { POINTS } from "./points";

export const SPORT_IDS = ["hockey", "football", "basketball"] as const;
export type SportId = (typeof SPORT_IDS)[number];

/** Existing endpoints default to hockey (real Liiga data). */
export const DEFAULT_SPORT: SportId = "hockey";

/**
 * The before-the-game picks a sport offers.
 * - winner: one of the two teams
 * - outcome_1x2: home / draw / away (the draw is a pick too)
 * - exact_score: the score after regulation (hockey 60 min, football 90 min)
 * - scorer: a player who scores at least once (first or any goal)
 * - margin_band: the winner's margin in points (1–5 / 6–10 / 11+)
 * - top_scorer: the player with the most points in the game
 */
export type PickKind =
  "winner" | "outcome_1x2" | "exact_score" | "scorer" | "margin_band" | "top_scorer";

/** Questions while the game is live; the quiz and vote come after it. */
export type LiveQuestionKind = "next_goal" | "period_goal" | "poll";
export type AfterQuestionKind = "result_quiz" | "player_vote";

export interface SportPick {
  kind: PickKind;
  points: number;
}

export interface SportConfig {
  id: SportId;
  /** Regulation periods and their length: hockey 3 × 20 min, football 2 × 45, basketball 4 × 10. */
  regulation_periods: number;
  period_seconds: number;
  /** Football can end in a draw; hockey and basketball always have a winner. */
  allows_draw: boolean;
  /** Before-the-game picks, in screen order. */
  picks: readonly SportPick[];
  live_questions: readonly LiveQuestionKind[];
  after_questions: readonly AfterQuestionKind[];
  /** "Data says" (prediction model) and the AI preview / summary: real Liiga data only. */
  has_model: boolean;
}

export const SPORTS: Readonly<Record<SportId, SportConfig>> = {
  hockey: {
    id: "hockey",
    regulation_periods: 3,
    period_seconds: 20 * 60,
    allows_draw: false,
    picks: [
      { kind: "winner", points: POINTS.winner },
      { kind: "exact_score", points: POINTS.exact_score },
      { kind: "scorer", points: POINTS.scorer },
    ],
    live_questions: ["next_goal", "period_goal", "poll"],
    after_questions: ["result_quiz", "player_vote"],
    has_model: true,
  },
  football: {
    id: "football",
    regulation_periods: 2,
    period_seconds: 45 * 60,
    allows_draw: true,
    picks: [
      { kind: "outcome_1x2", points: POINTS.winner },
      { kind: "exact_score", points: POINTS.exact_score },
      { kind: "scorer", points: POINTS.scorer },
    ],
    live_questions: ["next_goal", "poll"],
    after_questions: ["result_quiz", "player_vote"],
    has_model: false,
  },
  basketball: {
    id: "basketball",
    regulation_periods: 4,
    period_seconds: 10 * 60,
    allows_draw: false,
    picks: [
      { kind: "winner", points: POINTS.winner },
      { kind: "margin_band", points: POINTS.margin_band },
      { kind: "top_scorer", points: POINTS.top_scorer },
    ],
    live_questions: ["poll"],
    after_questions: ["player_vote"],
    has_model: false,
  },
};

export function is_sport_id(value: string): value is SportId {
  return (SPORT_IDS as readonly string[]).includes(value);
}

/** The sport's config; throws for a value that is not a sport (e.g. a bad DB row). */
export function sport_config(sport: string): SportConfig {
  if (!is_sport_id(sport)) {
    throw new Error(`Unknown sport "${sport}"`);
  }
  return SPORTS[sport];
}

/** Points of one pick kind in this sport, or 0 when the sport has no such pick. */
export function pick_points(sport: SportId, kind: PickKind): number {
  return SPORTS[sport].picks.find((pick) => pick.kind === kind)?.points ?? 0;
}

export function has_pick(sport: SportId, kind: PickKind): boolean {
  return SPORTS[sport].picks.some((pick) => pick.kind === kind);
}

/** Basketball: the winner's margin in points. */
export const MARGIN_BANDS = ["1_5", "6_10", "11_plus"] as const;
export type MarginBand = (typeof MARGIN_BANDS)[number];

/** 1–5 → "1_5", 6–10 → "6_10", 11 or more → "11_plus"; null for a tie (0). */
export function margin_band_of(margin: number): MarginBand | null {
  const points = Math.abs(margin);
  if (points === 0) {
    return null;
  }
  if (points <= 5) {
    return "1_5";
  }
  return points <= 10 ? "6_10" : "11_plus";
}
