import type { Crowd, GameDetail, GameSummary, Question } from "@voita_kone/shared_types";
import {
  DRAW_KEY,
  POINTS,
  SPORTS,
  decide_next_goal,
  decide_period_goal,
  has_pick,
  has_scored,
  is_bold_pick,
  max_pick_points,
  score_pre_game,
  score_after_regulation as regulation_score,
  winner_team_id as result_winner,
  type GameResult,
  type CrowdSplit,
  type PreGamePick,
} from "@voita_kone/scoring";
import { DRAW_PICK, type GamePicks } from "./picks";

// Points for one game, from the user's stored picks and the real result (docs/product.md).
// All rules come from @voita_kone/scoring, the same rules the API scores with. Real games save
// every pick to the API (and copy the saved answers back here), so both show the same points.

export { POINTS };

/** The fans' split in the shape the scoring rules use (all picks are in at puck drop). */
export function to_crowd_split(
  game: { home_team: { id: string }; away_team: { id: string } },
  crowd: Crowd | null,
): CrowdSplit | null {
  if (!crowd) {
    return null;
  }
  return {
    total_picks: crowd.total_picks,
    picks_by_team: {
      [game.home_team.id]: crowd.home_picks,
      [game.away_team.id]: crowd.away_picks,
      [DRAW_KEY]: crowd.draw_picks,
    },
  };
}

/** The crowd key of the device's winner pick: a team id or the draw; null when not picked. */
export function picked_outcome(picks: GamePicks): string | null {
  if (picks.winner_team_id === null) {
    return null;
  }
  return picks.winner_team_id === DRAW_PICK ? DRAW_KEY : picks.winner_team_id;
}

/** The device's picks as the scoring rules read them, for the game's sport. */
export function to_scoring_pick(picks: GamePicks, game: GameSummary): PreGamePick {
  const has_score = has_pick(game.sport, "exact_score");
  return {
    // Not picked can never be right (null would mean a draw).
    winner_team_id:
      picks.winner_team_id === DRAW_PICK ? null : (picks.winner_team_id ?? "not_picked"),
    home_goals: has_score ? picks.home_goals : null,
    away_goals: has_score ? picks.away_goals : null,
    scorer_id: picks.scorer_id,
    margin_band: has_pick(game.sport, "margin_band") ? picks.margin_band : null,
  };
}

/** Points per pick. null = not picked (or not decided yet); 0 = picked and wrong. */
export interface GamePoints {
  /** Winner, or the 1X2 outcome in football. */
  winner: number | null;
  exact_score: number | null;
  scorer: number | null;
  /** Basketball. */
  margin_band: number | null;
  top_scorer: number | null;
  /** +5 when the winner is right and fewer than 30% of the fans picked it. */
  bold_call: number | null;
  next_goal: { correct: number; decided: number; points: number };
  period_goal: number | null;
  quiz: { correct: number; answered: number; points: number };
  vote: number | null;
  total: number;
}

export interface PointsInput {
  picks: GamePicks;
  game: GameDetail;
  /** The fans' split, for the bold call; null without picks. */
  crowd: Crowd | null;
  /** The result quiz questions (with the right answer once the user has answered). */
  quiz: readonly Question[];
}

export function to_game_result(game: GameDetail): GameResult {
  return {
    home_team_id: game.home_team.id,
    away_team_id: game.away_team.id,
    home_goals: game.home_goals ?? 0,
    away_goals: game.away_goals ?? 0,
    ended_in: game.ended_in,
    goals: game.events
      .filter((event) => event.event_type === "goal")
      .map((event) => ({
        team_id: event.team_id,
        player_id: event.player?.id ?? null,
        period: event.period,
      })),
    top_scorer_id: game.top_scorer?.id ?? null,
  };
}

export function winner_team_id(game: GameDetail): string | null {
  if (game.home_goals === null || game.away_goals === null) {
    return null;
  }
  return result_winner(to_game_result(game));
}

/** "Exact score" means the score after regulation (hockey 60 min, football 90 min). */
export function score_after_regulation(game: GameDetail): { home: number; away: number } {
  return regulation_score(to_game_result(game), SPORTS[game.sport].regulation_periods);
}

function live_state(game: GameDetail) {
  const result = to_game_result(game);
  return {
    home_team_id: result.home_team_id,
    away_team_id: result.away_team_id,
    goals: result.goals,
    period: game.period,
    is_final: game.state === "final",
  };
}

function next_goal_points(picks: GamePicks, game: GameDetail): GamePoints["next_goal"] {
  const state = live_state(game);
  let correct = 0;
  let decided = 0;
  for (const pick of picks.next_goal_picks) {
    const actual = decide_next_goal(state, pick.goal_index);
    if (actual === null) {
      continue;
    }
    decided += 1;
    if (actual === pick.choice) {
      correct += 1;
    }
  }
  return { correct, decided, points: correct * POINTS.next_goal };
}

function period_goal_points(picks: GamePicks, game: GameDetail): number | null {
  const pick = picks.period_goal;
  if (!pick) {
    return null;
  }
  const actual = decide_period_goal(live_state(game), pick.period);
  if (actual === null) {
    return null;
  }
  return actual === pick.answer ? POINTS.period_goal : 0;
}

function quiz_points(picks: GamePicks, quiz: readonly Question[]): GamePoints["quiz"] {
  const answered = quiz.filter((question) => picks.quiz_answers[question.id] !== undefined);
  const correct = answered.filter(
    (question) =>
      question.correct_option !== null &&
      picks.quiz_answers[question.id] === question.correct_option,
  ).length;
  return { correct, answered: answered.length, points: correct * POINTS.quiz_each };
}

export function compute_game_points({ picks, game, crowd, quiz }: PointsInput): GamePoints {
  const is_final = game.state === "final";
  const made_prematch_picks = picks.locked_at !== null || picks.winner_team_id !== null;
  const result = to_game_result(game);
  // The before-the-game points once the game is final (winner picked or not).
  const final_points = is_final
    ? score_pre_game(game.sport, to_scoring_pick(picks, game), result, to_crowd_split(game, crowd))
    : null;

  const winner = final_points && picks.winner_team_id !== null ? final_points.winner : null;
  const exact_score =
    final_points && made_prematch_picks && has_pick(game.sport, "exact_score")
      ? final_points.exact_score
      : null;
  // A scorer's points show as soon as the player scores, also during the game.
  let scorer: number | null = null;
  if (has_pick(game.sport, "scorer") && picks.scorer_id !== null) {
    if (has_scored(result, picks.scorer_id)) {
      scorer = POINTS.scorer;
    } else if (is_final) {
      scorer = 0;
    }
  }
  const margin_band =
    final_points && picks.margin_band !== null && has_pick(game.sport, "margin_band")
      ? final_points.margin_band
      : null;
  const top_scorer =
    final_points && picks.scorer_id !== null && has_pick(game.sport, "top_scorer")
      ? final_points.top_scorer
      : null;
  const bold_call = final_points && final_points.bold_call > 0 ? final_points.bold_call : null;
  const next_goal = next_goal_points(picks, game);
  const period_goal = period_goal_points(picks, game);
  const quiz_result = quiz_points(picks, quiz);
  const vote = picks.vote_player !== null ? POINTS.vote : null;

  const total =
    (winner ?? 0) +
    (exact_score ?? 0) +
    (scorer ?? 0) +
    (margin_band ?? 0) +
    (top_scorer ?? 0) +
    (bold_call ?? 0) +
    next_goal.points +
    (period_goal ?? 0) +
    quiz_result.points +
    (vote ?? 0);

  return {
    winner,
    exact_score,
    scorer,
    margin_band,
    top_scorer,
    bold_call,
    next_goal,
    period_goal,
    quiz: quiz_result,
    vote,
    total,
  };
}

/** Points during the game so far: live picks only. */
export function live_points(points: GamePoints): number {
  return points.next_goal.points + (points.period_goal ?? 0);
}

/** Before the game: the most a full set of picks can earn (+5 when the pick is a bold call). */
export function possible_points(picks: GamePicks, game: GameSummary, crowd: Crowd | null): number {
  const outcome = picked_outcome(picks);
  const bold = outcome !== null && is_bold_pick(to_crowd_split(game, crowd), outcome);
  return max_pick_points(game.sport) + (bold ? POINTS.bold_call : 0);
}
