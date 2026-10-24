import type { GameDetail, Question } from "@voita_kone/shared_types";
import {
  POINTS,
  decide_next_goal,
  decide_period_goal,
  has_scored,
  score_ai_pick,
  score_pre_game,
  score_after_regulation as regulation_score,
  winner_team_id as result_winner,
  type GameResult,
  type PreGamePick,
} from "@voita_kone/scoring";
import type { GamePicks } from "./picks";

// Points for one game, from the user's stored picks and the real result (docs/product.md).
// All rules come from @voita_kone/scoring, the same rules the API scores with. Real games save
// every pick to the API (and copy the saved answers back here), so both show the same points.

export { POINTS };

/** The AI's own pre-game pick, in the shape the scoring rules use. */
export type AiPick = PreGamePick;

/** Points per pick. null = not picked (or not decided yet); 0 = picked and wrong. */
export interface GamePoints {
  winner: number | null;
  exact_score: number | null;
  scorer: number | null;
  beat_ai: number | null;
  next_goal: { correct: number; decided: number; points: number };
  period_goal: number | null;
  quiz: { correct: number; answered: number; points: number };
  vote: number | null;
  total: number;
  /** The AI's points for its own pre-game pick (winner, exact score, scorer). */
  ai_total: number;
}

export interface PointsInput {
  picks: GamePicks;
  game: GameDetail;
  ai_pick: AiPick | null;
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
  };
}

export function winner_team_id(game: GameDetail): string | null {
  if (game.home_goals === null || game.away_goals === null) {
    return null;
  }
  return result_winner(to_game_result(game));
}

/** "Exact score" means the score after 60 minutes; overtime and shootout goals don't count. */
export function score_after_regulation(game: GameDetail): { home: number; away: number } {
  return regulation_score(to_game_result(game));
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

function ai_points(game: GameDetail, ai_pick: AiPick | null): number {
  if (!ai_pick || game.state !== "final") {
    return 0;
  }
  return score_ai_pick(ai_pick, to_game_result(game)).total;
}

export function compute_game_points({ picks, game, ai_pick, quiz }: PointsInput): GamePoints {
  const is_final = game.state === "final";
  const made_prematch_picks = picks.locked_at !== null || picks.winner_team_id !== null;
  const result = to_game_result(game);
  // The before-the-game points once the game is final (winner picked or not).
  const final_points = is_final
    ? score_pre_game(
        {
          winner_team_id: picks.winner_team_id ?? "",
          home_goals: picks.home_goals,
          away_goals: picks.away_goals,
          scorer_id: picks.scorer_id,
        },
        result,
        ai_pick,
      )
    : null;

  const winner = final_points && picks.winner_team_id !== null ? final_points.winner : null;
  const exact_score = final_points && made_prematch_picks ? final_points.exact_score : null;
  // A scorer's points show as soon as the player scores, also during the game.
  let scorer: number | null = null;
  if (picks.scorer_id !== null && has_scored(result, picks.scorer_id)) {
    scorer = POINTS.scorer;
  } else if (picks.scorer_id !== null && is_final) {
    scorer = 0;
  }
  const beat_ai = final_points && final_points.beat_ai > 0 ? final_points.beat_ai : null;
  const next_goal = next_goal_points(picks, game);
  const period_goal = period_goal_points(picks, game);
  const quiz_result = quiz_points(picks, quiz);
  const vote = picks.vote_player !== null ? POINTS.vote : null;

  const total =
    (winner ?? 0) +
    (exact_score ?? 0) +
    (scorer ?? 0) +
    (beat_ai ?? 0) +
    next_goal.points +
    (period_goal ?? 0) +
    quiz_result.points +
    (vote ?? 0);

  return {
    winner,
    exact_score,
    scorer,
    beat_ai,
    next_goal,
    period_goal,
    quiz: quiz_result,
    vote,
    total,
    ai_total: ai_points(game, ai_pick),
  };
}

/** Points during the game so far: live picks only. */
export function live_points(points: GamePoints): number {
  return points.next_goal.points + (points.period_goal ?? 0);
}

/** Before the game: the most a full set of picks can earn (+5 when picking against the AI). */
export function possible_points(picks: GamePicks, ai_pick: AiPick | null): number {
  const against_ai =
    ai_pick !== null &&
    picks.winner_team_id !== null &&
    picks.winner_team_id !== ai_pick.winner_team_id;
  return POINTS.winner + POINTS.exact_score + POINTS.scorer + (against_ai ? POINTS.beat_ai : 0);
}
