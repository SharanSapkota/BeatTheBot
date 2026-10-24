import type { PlayedGame } from "./model_types";
import { model_config } from "./season_config";

/**
 * Strengths relative to the league average (1.0 = average).
 * attack 1.2 = scores 20% more than average; defence 1.2 = lets in 20% more (weaker).
 */
export interface TeamStrength {
  attack: number;
  defence: number;
  /** Finished games the strengths were measured from. */
  games: number;
}

export interface StrengthModel {
  /** Average 60-minute goals of the home team and the away team in one game. */
  league_home_goals: number;
  league_away_goals: number;
  /** league_home_goals / league_away_goals, measured from the data. */
  home_advantage: number;
  teams: ReadonlyMap<string, TeamStrength>;
}

export interface StrengthOptions {
  half_life_games: number;
  prior_games: number;
  prior_league_games: number;
  default_home_goals: number;
  default_away_goals: number;
  iterations: number;
}

export const default_strength_options: StrengthOptions = {
  half_life_games: model_config.half_life_games,
  prior_games: model_config.prior_games,
  prior_league_games: model_config.prior_league_games,
  default_home_goals: model_config.default_home_goals,
  default_away_goals: model_config.default_away_goals,
  iterations: model_config.strength_iterations,
};

/**
 * Goals after 60 minutes. The final score of an overtime or shootout game includes the
 * winning goal, so the 60-minute score was a tie one goal lower for the winner.
 */
export function regulation_score(game: PlayedGame): { home: number; away: number } {
  if (game.ended_in === "regulation") {
    return { home: game.home_goals, away: game.away_goals };
  }
  const tied = Math.min(game.home_goals, game.away_goals);
  return { home: tied, away: tied };
}

interface WeightedGame {
  game: PlayedGame;
  weight: number;
}

/** Each team's games, newest first, with weight 0.5^(games back / half-life). */
function weighted_games_by_team(
  team_ids: readonly string[],
  games_by_time: readonly PlayedGame[],
  half_life_games: number,
): Map<string, WeightedGame[]> {
  const by_team = new Map<string, PlayedGame[]>(team_ids.map((team_id) => [team_id, []]));
  for (const game of games_by_time) {
    by_team.get(game.home_team_id)?.push(game);
    by_team.get(game.away_team_id)?.push(game);
  }
  const weighted = new Map<string, WeightedGame[]>();
  for (const [team_id, team_games] of by_team) {
    const newest_first = [...team_games].reverse();
    weighted.set(
      team_id,
      newest_first.map((game, games_back) => ({
        game,
        weight: 0.5 ** (games_back / half_life_games),
      })),
    );
  }
  return weighted;
}

function league_averages(games: readonly PlayedGame[], options: StrengthOptions) {
  let home_goals = 0;
  let away_goals = 0;
  for (const game of games) {
    const score = regulation_score(game);
    home_goals += score.home;
    away_goals += score.away;
  }
  const prior = options.prior_league_games;
  return {
    league_home_goals: (home_goals + prior * options.default_home_goals) / (games.length + prior),
    league_away_goals: (away_goals + prior * options.default_away_goals) / (games.length + prior),
  };
}

function normalise(values: Map<string, number>): void {
  const mean = [...values.values()].reduce((sum, value) => sum + value, 0) / values.size;
  if (mean > 0) {
    for (const [key, value] of values) {
      values.set(key, value / mean);
    }
  }
}

/**
 * Attack and defence per team from finished games, opponent-adjusted:
 * attack = weighted goals for / weighted goals an average team would score against the same
 * opponents. Recent games weigh more; `prior_games` of league-average play pull teams with
 * few games toward 1.0.
 */
export function compute_team_strengths(
  team_ids: readonly string[],
  games: readonly PlayedGame[],
  options: StrengthOptions = default_strength_options,
): StrengthModel {
  const games_by_time = [...games].sort(
    (first, second) => first.start_time.getTime() - second.start_time.getTime(),
  );
  const averages = league_averages(games_by_time, options);
  const weighted = weighted_games_by_team(team_ids, games_by_time, options.half_life_games);
  const prior_goals =
    (options.prior_games * (averages.league_home_goals + averages.league_away_goals)) / 2;

  let attack = new Map(team_ids.map((team_id) => [team_id, 1]));
  let defence = new Map(team_ids.map((team_id) => [team_id, 1]));

  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const next_attack = new Map<string, number>();
    const next_defence = new Map<string, number>();
    for (const team_id of team_ids) {
      let goals_for = prior_goals;
      let expected_for = prior_goals;
      let goals_against = prior_goals;
      let expected_against = prior_goals;
      for (const { game, weight } of weighted.get(team_id) ?? []) {
        const score = regulation_score(game);
        const is_home = game.home_team_id === team_id;
        const opponent_id = is_home ? game.away_team_id : game.home_team_id;
        const own_average = is_home ? averages.league_home_goals : averages.league_away_goals;
        const opponent_average = is_home ? averages.league_away_goals : averages.league_home_goals;
        goals_for += weight * (is_home ? score.home : score.away);
        expected_for += weight * own_average * (defence.get(opponent_id) ?? 1);
        goals_against += weight * (is_home ? score.away : score.home);
        expected_against += weight * opponent_average * (attack.get(opponent_id) ?? 1);
      }
      next_attack.set(team_id, goals_for / expected_for);
      next_defence.set(team_id, goals_against / expected_against);
    }
    normalise(next_attack);
    normalise(next_defence);
    attack = next_attack;
    defence = next_defence;
  }

  const teams = new Map<string, TeamStrength>(
    team_ids.map((team_id) => [
      team_id,
      {
        attack: attack.get(team_id) ?? 1,
        defence: defence.get(team_id) ?? 1,
        games: weighted.get(team_id)?.length ?? 0,
      },
    ]),
  );
  return {
    ...averages,
    home_advantage: averages.league_home_goals / averages.league_away_goals,
    teams,
  };
}
