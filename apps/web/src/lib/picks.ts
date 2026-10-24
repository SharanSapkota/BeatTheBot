import { useCallback, useSyncExternalStore } from "react";
import type { Question } from "@voita_kone/shared_types";
import { z } from "zod";
import { read_stored, write_stored } from "./storage";

// The user's picks for one game on this device. Real games also save them to the API (before-game
// picks and answers to questions); demo replays keep them here only. Several components on a
// screen read the same picks, so they share one small store.

export const side_schema = z.enum(["home", "away", "none"]);

export const game_picks_schema = z.object({
  winner_team_id: z.string().nullable(),
  home_goals: z.number().int().min(0).max(9),
  away_goals: z.number().int().min(0).max(9),
  scorer_id: z.string().nullable(),
  /** ISO time of "Lock in my picks"; any change clears it. */
  locked_at: z.string().nullable(),
  /** goal_index = goals already scored when the pick was made, so it predicts goal number goal_index + 1. */
  next_goal_picks: z.array(z.object({ goal_index: z.number().int().min(0), choice: side_schema })),
  /** next_goal_opened_at[goal_index] = when that next-goal pick was first shown; its 2-minute window starts then. */
  next_goal_opened_at: z.record(z.string(), z.string()),
  period_goal: z.object({ period: z.number().int(), answer: z.enum(["yes", "no"]) }).nullable(),
  quiz_answers: z.record(z.string(), z.string()),
  /** Option id (player id) of the player-of-the-game vote. */
  vote_player: z.string().nullable(),
  /** Option id of the fan poll answer (no points). */
  poll_answer: z.string().nullable().default(null),
});

export type Side = z.infer<typeof side_schema>;
export type GamePicks = z.infer<typeof game_picks_schema>;

/** The design starts the score at the most common Liiga result, 3–2. */
export const EMPTY_PICKS: GamePicks = {
  winner_team_id: null,
  home_goals: 3,
  away_goals: 2,
  scorer_id: null,
  locked_at: null,
  next_goal_picks: [],
  next_goal_opened_at: {},
  period_goal: null,
  quiz_answers: {},
  vote_player: null,
  poll_answer: null,
};

const cache = new Map<string, GamePicks>();
const listeners = new Set<() => void>();

function storage_key(game_id: string): string {
  return `picks_${game_id}`;
}

export function read_picks(game_id: string): GamePicks {
  const cached = cache.get(game_id);
  if (cached) {
    return cached;
  }
  const stored = read_stored(storage_key(game_id), game_picks_schema) ?? EMPTY_PICKS;
  cache.set(game_id, stored);
  return stored;
}

export function save_picks(game_id: string, picks: GamePicks): void {
  cache.set(game_id, picks);
  write_stored(storage_key(game_id), picks);
  for (const listener of listeners) {
    listener();
  }
}

const MAX_GOALS = 9;

/**
 * Starts the exact-score pick at the AI's predicted score, only while the user has never
 * changed this game's picks.
 */
export function prefill_score(game_id: string, home_goals: number, away_goals: number): void {
  if (read_stored(storage_key(game_id), game_picks_schema) !== null) {
    return;
  }
  save_picks(game_id, {
    ...read_picks(game_id),
    home_goals: Math.min(MAX_GOALS, home_goals),
    away_goals: Math.min(MAX_GOALS, away_goals),
  });
}

/** Forgets the in-memory copy, as a page reload would (used by tests). */
export function clear_picks_cache(): void {
  cache.clear();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The picks with one answer to a question (live pick, quiz, vote or poll) added. */
export function with_answer(
  picks: GamePicks,
  question: Pick<Question, "id" | "question_type" | "target">,
  answer: string,
): GamePicks {
  const target = question.target ?? 0;
  switch (question.question_type) {
    case "next_goal":
      return {
        ...picks,
        next_goal_picks: [
          ...picks.next_goal_picks.filter((pick) => pick.goal_index !== target),
          { goal_index: target, choice: side_schema.parse(answer) },
        ],
      };
    case "period_goal":
      return { ...picks, period_goal: { period: target, answer: answer === "yes" ? "yes" : "no" } };
    case "result_quiz":
      return { ...picks, quiz_answers: { ...picks.quiz_answers, [question.id]: answer } };
    case "player_vote":
      return { ...picks, vote_player: answer };
    case "poll":
      return { ...picks, poll_answer: answer };
  }
}

/** The answer stored on this device for a question, or null. */
export function answer_of(
  picks: GamePicks,
  question: Pick<Question, "id" | "question_type" | "target">,
): string | null {
  const target = question.target ?? 0;
  switch (question.question_type) {
    case "next_goal":
      return picks.next_goal_picks.find((pick) => pick.goal_index === target)?.choice ?? null;
    case "period_goal":
      return picks.period_goal?.period === target ? picks.period_goal.answer : null;
    case "result_quiz":
      return picks.quiz_answers[question.id] ?? null;
    case "player_vote":
      return picks.vote_player;
    case "poll":
      return picks.poll_answer;
  }
}

/** Changes to the pre-game picks unlock them again, as in the design. */
export function with_prematch_change(picks: GamePicks, change: Partial<GamePicks>): GamePicks {
  return { ...picks, ...change, locked_at: null };
}

export function useGamePicks(
  game_id: string,
): [GamePicks, (update: (picks: GamePicks) => GamePicks) => void] {
  const picks = useSyncExternalStore(subscribe, () => read_picks(game_id));
  const update = useCallback(
    (change: (current: GamePicks) => GamePicks) => {
      save_picks(game_id, change(read_picks(game_id)));
    },
    [game_id],
  );
  return [picks, update];
}
