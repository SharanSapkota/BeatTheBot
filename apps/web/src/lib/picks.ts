import { useCallback, useSyncExternalStore } from "react";
import { z } from "zod";
import { read_stored, write_stored } from "./storage";

// The user's picks for one game, kept in localStorage until accounts exist (step 4).
// Several components on a screen read the same picks, so they share one small store.

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
  vote_player: z.string().nullable(),
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

/** Forgets the in-memory copy, as a page reload would (used by tests). */
export function clear_picks_cache(): void {
  cache.clear();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
