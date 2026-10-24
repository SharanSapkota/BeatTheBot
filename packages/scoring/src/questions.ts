import { POINTS } from "./points";

// Live picks, result quiz and player vote (docs/product.md → Games and scoring). Pure: the API
// scores answers with these rules and the web app shows the same numbers.

export type QuestionType = "next_goal" | "period_goal" | "result_quiz" | "player_vote" | "poll";
export type NextGoalAnswer = "home" | "away" | "none";
export type PeriodGoalAnswer = "yes" | "no";

export const QUESTION_POINTS: Readonly<Record<QuestionType, number>> = {
  next_goal: POINTS.next_goal,
  period_goal: POINTS.period_goal,
  result_quiz: POINTS.quiz_each,
  player_vote: POINTS.vote,
  // Fan poll: best player so far, no points.
  poll: 0,
};

const SHOOTOUT_PERIOD = 5;

export interface LiveGoal {
  team_id: string | null;
  /** 1–3 regulation, 4 overtime, 5 shootout (not a real goal). */
  period: number;
}

/** What a live question needs to know about the game so far. */
export interface LiveGameState {
  home_team_id: string;
  away_team_id: string;
  /** Goals in time order. */
  goals: readonly LiveGoal[];
  /** Current period, null before puck drop. */
  period: number | null;
  is_final: boolean;
}

function real_goals(state: LiveGameState): LiveGoal[] {
  return state.goals.filter((goal) => goal.period < SHOOTOUT_PERIOD);
}

/**
 * Who scores goal number `goal_index + 1`: the team's side, "none" when the game ended without
 * it, or null while it is not decided yet.
 */
export function decide_next_goal(state: LiveGameState, goal_index: number): NextGoalAnswer | null {
  const goal = real_goals(state)[goal_index];
  if (goal) {
    return goal.team_id === state.home_team_id ? "home" : "away";
  }
  return state.is_final ? "none" : null;
}

/** "Goal in period N?": yes as soon as one is scored, no once the period is over. */
export function decide_period_goal(state: LiveGameState, period: number): PeriodGoalAnswer | null {
  if (real_goals(state).some((goal) => goal.period === period)) {
    return "yes";
  }
  const period_over = state.is_final || (state.period ?? 0) > period;
  return period_over ? "no" : null;
}

export interface ScorableQuestion {
  question_type: QuestionType;
  /** Null for votes and polls, and for live picks that are not decided yet. */
  correct_option: string | null;
}

/** Points for one answer, or null while the question is not decided. */
export function score_answer(question: ScorableQuestion, answer: string): number | null {
  const points = QUESTION_POINTS[question.question_type];
  if (question.question_type === "player_vote" || question.question_type === "poll") {
    return points;
  }
  if (question.correct_option === null) {
    return null;
  }
  return answer === question.correct_option ? points : 0;
}
