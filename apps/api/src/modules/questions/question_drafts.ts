import {
  QUESTION_POINTS,
  SPORTS,
  decide_next_goal,
  decide_period_goal,
  type LiveGameState,
  type QuestionType,
} from "@voita_kone/scoring";
import type { GameDetail, PlayerSummary, QuestionOption } from "@voita_kone/shared_types";
import type { QuizDraft } from "./result_quiz";

// What questions a game has at a given moment, built from the game as the API shows it. Pure:
// the service saves them for real games and returns them as they are for demo replays.

const MINUTE_MS = 60 * 1000;
/** A next-goal pick is open for 2 minutes after it is first shown (after each goal). */
export const NEXT_GOAL_WINDOW_MS = 2 * MINUTE_MS;
/** "Goal in the 3rd period?" locks when the 3rd period starts. */
export const PERIOD_GOAL_PERIOD = 3;
/** Live questions lock at the latest this long after puck drop. */
const LIVE_LOCK_AFTER_START_MS = 6 * 60 * MINUTE_MS;
/** The quiz and the vote stay open for a week after the game. */
const AFTER_OPEN_MS = 7 * 24 * 60 * MINUTE_MS;
const PLAYER_OPTION_COUNT = 4;
const SHOOTOUT_PERIOD = 5;

export interface QuestionDraft {
  key: string;
  phase: "live" | "after";
  question_type: QuestionType;
  prompt: string;
  options: QuestionOption[];
  correct_option: string | null;
  explanation: { right: string; wrong: string } | null;
  points: number;
  target: number | null;
  fact_ids: string[];
  opens_at: Date;
  locks_at: Date;
}

function real_goals(game: GameDetail) {
  return game.events.filter(
    (event) => event.event_type === "goal" && event.period < SHOOTOUT_PERIOD,
  );
}

export function to_live_state(game: GameDetail): LiveGameState {
  return {
    home_team_id: game.home_team.id,
    away_team_id: game.away_team.id,
    goals: real_goals(game).map((goal) => ({ team_id: goal.team_id, period: goal.period })),
    period: game.period,
    is_final: game.state === "final",
  };
}

function full_name(player: { first_name: string; last_name: string }): string {
  return `${player.first_name} ${player.last_name}`;
}

/** The game's scorers (most goals first), then the teams' best season scorers. */
export function player_options(
  game: GameDetail,
  players: readonly PlayerSummary[],
): QuestionOption[] {
  const goal_counts = new Map<string, { label: string; goals: number }>();
  for (const goal of real_goals(game)) {
    if (goal.player) {
      const current = goal_counts.get(goal.player.id);
      goal_counts.set(goal.player.id, {
        label: full_name(goal.player),
        goals: (current?.goals ?? 0) + 1,
      });
    }
  }
  const scorers = [...goal_counts.entries()]
    .sort((first, second) => second[1].goals - first[1].goals)
    .map(([id, { label }]) => ({ id, label }));
  const season_best = [...players]
    .filter((player) => player.position !== "goalie")
    .sort((first, second) => second.season_goals - first.season_goals)
    .map((player) => ({ id: player.id, label: full_name(player) }));
  const options: QuestionOption[] = [];
  for (const option of [...scorers, ...season_best]) {
    if (options.length < PLAYER_OPTION_COUNT && !options.some((other) => other.id === option.id)) {
      options.push(option);
    }
  }
  return options;
}

/** Only the question types the sport offers (`SPORTS[sport].live_questions` / `after_questions`). */
function of_sport(game: GameDetail, drafts: QuestionDraft[]): QuestionDraft[] {
  const { live_questions, after_questions } = SPORTS[game.sport];
  const offered = new Set<QuestionType>([...live_questions, ...after_questions]);
  return drafts.filter((draft) => offered.has(draft.question_type));
}

/**
 * While the game is live: next goal, goal in the 3rd period and the fan poll (hockey); next goal
 * and the poll (football); the poll only (basketball).
 */
export function build_live_drafts(
  game: GameDetail,
  players: readonly PlayerSummary[],
  now: Date,
): QuestionDraft[] {
  if (game.state !== "live") {
    return [];
  }
  const goal_count = real_goals(game).length;
  const live_lock = new Date(new Date(game.start_time).getTime() + LIVE_LOCK_AFTER_START_MS);
  const base = { phase: "live" as const, explanation: null, fact_ids: [], opens_at: now };
  const drafts: QuestionDraft[] = [
    {
      ...base,
      key: `next_goal:${String(goal_count)}`,
      question_type: "next_goal",
      prompt: "Who scores the next goal?",
      options: [
        { id: "home", label: game.home_team.name },
        { id: "away", label: game.away_team.name },
        { id: "none", label: "No more goals" },
      ],
      correct_option: null,
      points: QUESTION_POINTS.next_goal,
      target: goal_count,
      locks_at: new Date(now.getTime() + NEXT_GOAL_WINDOW_MS),
    },
    {
      ...base,
      key: `period_goal:${String(PERIOD_GOAL_PERIOD)}`,
      question_type: "period_goal",
      prompt: "Goal in the 3rd period?",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
      correct_option: null,
      points: QUESTION_POINTS.period_goal,
      target: PERIOD_GOAL_PERIOD,
      locks_at: live_lock,
    },
  ];
  const poll_options = player_options(game, players);
  if (poll_options.length >= 2) {
    drafts.push({
      ...base,
      key: "poll",
      question_type: "poll",
      prompt: "Best player so far",
      options: poll_options,
      correct_option: null,
      points: QUESTION_POINTS.poll,
      target: null,
      locks_at: live_lock,
    });
  }
  return of_sport(game, drafts);
}

/** The result quiz (hockey, football) and the player vote, once the game is final. */
export function build_after_drafts(
  game: GameDetail,
  players: readonly PlayerSummary[],
  quiz: readonly QuizDraft[],
  now: Date,
): QuestionDraft[] {
  if (game.state !== "final") {
    return [];
  }
  const base = {
    phase: "after" as const,
    opens_at: now,
    locks_at: new Date(now.getTime() + AFTER_OPEN_MS),
  };
  const drafts: QuestionDraft[] = quiz.map((question) => ({
    ...base,
    ...question,
    question_type: "result_quiz",
    points: QUESTION_POINTS.result_quiz,
    target: null,
  }));
  const vote_options = player_options(game, players);
  if (vote_options.length >= 2) {
    drafts.push({
      ...base,
      key: "player_vote",
      question_type: "player_vote",
      prompt: "Player of the game",
      options: vote_options,
      correct_option: null,
      explanation: null,
      points: QUESTION_POINTS.player_vote,
      target: null,
      fact_ids: [],
    });
  }
  return of_sport(game, drafts);
}

export interface LockableQuestion {
  question_type: QuestionType;
  target: number | null;
  locks_at: Date;
}

/** Locked by time, or by the game: the next goal was scored, the period started, the game ended. */
export function is_question_locked(
  question: LockableQuestion,
  game: GameDetail,
  now: Date,
): boolean {
  if (now >= question.locks_at) {
    return true;
  }
  const is_final = game.state === "final";
  switch (question.question_type) {
    case "next_goal":
      return is_final || real_goals(game).length > (question.target ?? 0);
    case "period_goal":
      return is_final || (game.period ?? 0) >= (question.target ?? PERIOD_GOAL_PERIOD);
    case "poll":
      return is_final;
    case "result_quiz":
    case "player_vote":
      return false;
  }
}

/** The right answer as far as it is known now (live picks are decided by the game). */
export function current_correct_option(
  question: { question_type: QuestionType; target: number | null; correct_option: string | null },
  game: GameDetail,
): string | null {
  const state = to_live_state(game);
  switch (question.question_type) {
    case "next_goal":
      return decide_next_goal(state, question.target ?? 0);
    case "period_goal":
      return decide_period_goal(state, question.target ?? PERIOD_GOAL_PERIOD);
    default:
      return question.correct_option;
  }
}
