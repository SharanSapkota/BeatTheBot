import type { GameDetail, GameEvent, ResultQuiz } from "@voita_kone/shared_types";
import type { GamePicks, Side } from "./picks";

// Points for one game, from the user's stored picks and the real result (docs/product.md).
// Pure, so the same rules can move to the API in step 4.

export const POINTS = {
  winner: 10,
  exact_score: 25,
  scorer: 15,
  beat_ai: 5,
  next_goal: 5,
  period_goal: 3,
  quiz_each: 2,
  vote: 1,
} as const;

const SHOOTOUT_PERIOD = 5;
const REGULATION_PERIODS = 3;

export interface AiPick {
  winner_team_id: string;
  home_goals: number;
  away_goals: number;
  scorer_id: string | null;
}

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
  quiz: ResultQuiz | null;
}

/** Goals in time order. The shootout winner is not a real goal for picks. */
function goals_of(game: GameDetail): GameEvent[] {
  return game.events.filter(
    (event) => event.event_type === "goal" && event.period < SHOOTOUT_PERIOD,
  );
}

function side_of(game: GameDetail, team_id: string | null): Side {
  if (team_id === game.home_team.id) {
    return "home";
  }
  return team_id === game.away_team.id ? "away" : "none";
}

export function winner_team_id(game: GameDetail): string | null {
  if (game.home_goals === null || game.away_goals === null || game.home_goals === game.away_goals) {
    return null;
  }
  return game.home_goals > game.away_goals ? game.home_team.id : game.away_team.id;
}

/** "Exact score" means the score after 60 minutes; overtime and shootout goals don't count. */
export function score_after_regulation(game: GameDetail): { home: number; away: number } {
  const goals = goals_of(game);
  if (goals.length > 0) {
    const regulation_goals = goals.filter((goal) => goal.period <= REGULATION_PERIODS);
    return {
      home: regulation_goals.filter((goal) => side_of(game, goal.team_id) === "home").length,
      away: regulation_goals.filter((goal) => side_of(game, goal.team_id) === "away").length,
    };
  }
  const home = game.home_goals ?? 0;
  const away = game.away_goals ?? 0;
  if (game.ended_in === "regulation" || game.ended_in === null) {
    return { home, away };
  }
  // Without events: the winner scored the deciding goal after 60 minutes.
  return home > away ? { home: home - 1, away } : { home, away: away - 1 };
}

function scored(game: GameDetail, player_id: string | null): boolean {
  return player_id !== null && goals_of(game).some((goal) => goal.player?.id === player_id);
}

function next_goal_points(picks: GamePicks, game: GameDetail): GamePoints["next_goal"] {
  const goals = goals_of(game);
  const is_final = game.state === "final";
  let correct = 0;
  let decided = 0;
  for (const pick of picks.next_goal_picks) {
    const next_goal = goals[pick.goal_index];
    if (!next_goal && !is_final) {
      continue;
    }
    decided += 1;
    const actual: Side = next_goal ? side_of(game, next_goal.team_id) : "none";
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
  const had_goal = goals_of(game).some((goal) => goal.period === pick.period);
  const period_over = game.state === "final" || (game.period ?? 0) > pick.period;
  if (!had_goal && !period_over) {
    return null;
  }
  return had_goal === (pick.answer === "yes") ? POINTS.period_goal : 0;
}

function quiz_points(picks: GamePicks, quiz: ResultQuiz | null): GamePoints["quiz"] {
  const questions = quiz?.questions ?? [];
  const answered = questions.filter((question) => picks.quiz_answers[question.id] !== undefined);
  const correct = answered.filter(
    (question) => picks.quiz_answers[question.id] === question.correct_option,
  ).length;
  return { correct, answered: answered.length, points: correct * (quiz?.points_each ?? 0) };
}

function ai_points(game: GameDetail, ai_pick: AiPick | null): number {
  if (!ai_pick || game.state !== "final") {
    return 0;
  }
  const regulation = score_after_regulation(game);
  return (
    (ai_pick.winner_team_id === winner_team_id(game) ? POINTS.winner : 0) +
    (ai_pick.home_goals === regulation.home && ai_pick.away_goals === regulation.away
      ? POINTS.exact_score
      : 0) +
    (scored(game, ai_pick.scorer_id) ? POINTS.scorer : 0)
  );
}

export function compute_game_points({ picks, game, ai_pick, quiz }: PointsInput): GamePoints {
  const is_final = game.state === "final";
  const made_prematch_picks = picks.locked_at !== null || picks.winner_team_id !== null;
  const actual_winner = winner_team_id(game);
  const regulation = score_after_regulation(game);

  const winner_right = picks.winner_team_id !== null && picks.winner_team_id === actual_winner;
  const winner =
    is_final && picks.winner_team_id !== null ? (winner_right ? POINTS.winner : 0) : null;
  const exact_score =
    is_final && made_prematch_picks
      ? picks.home_goals === regulation.home && picks.away_goals === regulation.away
        ? POINTS.exact_score
        : 0
      : null;
  const scorer =
    picks.scorer_id === null
      ? null
      : scored(game, picks.scorer_id)
        ? POINTS.scorer
        : is_final
          ? 0
          : null;
  const ai_was_wrong = ai_pick !== null && ai_pick.winner_team_id !== actual_winner;
  const beat_ai = is_final && winner_right && ai_was_wrong ? POINTS.beat_ai : null;
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
