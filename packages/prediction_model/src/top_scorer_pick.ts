import type { PlayedGame } from "./model_types";

export type PlayerPosition = "goalie" | "defense" | "forward";

export interface ModelPlayer {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  position: PlayerPosition | null;
}

/** A goal from the game events (shootout attempts left out). */
export interface ModelGoal {
  game_id: string;
  team_id: string;
  scorer_id: string | null;
}

export interface ScorerPick {
  player_id: string;
  team_id: string;
  /** Goals in the team's last `recent_games` games. */
  recent_goals: number;
  recent_games: number;
  goals_per_game: number;
  season_goals: number;
}

export interface ScorerPickInput {
  team_id: string;
  players: readonly ModelPlayer[];
  /** Finished games before the game being predicted. */
  history: readonly PlayedGame[];
  goals: readonly ModelGoal[];
  recent_game_count?: number;
  min_games?: number;
}

const DEFAULT_RECENT_GAMES = 5;
const DEFAULT_MIN_GAMES = 3;

/** The team's most recent finished games, newest first. */
export function recent_team_games(
  team_id: string,
  history: readonly PlayedGame[],
  count: number,
): PlayedGame[] {
  return history
    .filter((game) => game.home_team_id === team_id || game.away_team_id === team_id)
    .sort((first, second) => second.start_time.getTime() - first.start_time.getTime())
    .slice(0, count);
}

function count_goals(
  goals: readonly ModelGoal[],
  team_id: string,
  game_ids: ReadonlySet<string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const goal of goals) {
    if (goal.scorer_id && goal.team_id === team_id && game_ids.has(goal.game_id)) {
      counts.set(goal.scorer_id, (counts.get(goal.scorer_id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The team's skater with the best goals per game over its last 5 games (at least 3 team
 * games needed), then most season goals. VERIFY: we have no per-game line-ups, so every
 * skater on the roster counts as having played all of those games.
 */
export function pick_top_scorer(input: ScorerPickInput): ScorerPick | null {
  const recent = recent_team_games(
    input.team_id,
    input.history,
    input.recent_game_count ?? DEFAULT_RECENT_GAMES,
  );
  if (recent.length < (input.min_games ?? DEFAULT_MIN_GAMES)) {
    return null;
  }
  const season_game_ids = new Set(input.history.map((game) => game.id));
  const recent_goals = count_goals(
    input.goals,
    input.team_id,
    new Set(recent.map((game) => game.id)),
  );
  const season_goals = count_goals(input.goals, input.team_id, season_game_ids);

  const candidates = input.players
    .filter((player) => player.team_id === input.team_id && player.position !== "goalie")
    .map((player) => ({
      player,
      recent_goals: recent_goals.get(player.id) ?? 0,
      season_goals: season_goals.get(player.id) ?? 0,
    }))
    .filter((candidate) => candidate.season_goals > 0)
    .sort(
      (first, second) =>
        second.recent_goals - first.recent_goals ||
        second.season_goals - first.season_goals ||
        first.player.last_name.localeCompare(second.player.last_name, "fi") ||
        first.player.id.localeCompare(second.player.id),
    );

  const best = candidates[0];
  if (!best) {
    return null;
  }
  return {
    player_id: best.player.id,
    team_id: input.team_id,
    recent_goals: best.recent_goals,
    recent_games: recent.length,
    goals_per_game: best.recent_goals / recent.length,
    season_goals: best.season_goals,
  };
}
