import { expected_goals, game_probabilities } from "./game_probabilities";
import { get_game_points, type FinishedGame } from "./game_points";
import type { ScheduledGame, Side } from "./model_types";
import { mulberry32, type Rng } from "./rng";
import { season_config, type TableRules } from "./season_config";
import type { StrengthModel } from "./team_strength";

export interface SimulationInput {
  team_ids: readonly string[];
  /** Results so far: the table starts from these. */
  played_games: readonly FinishedGame[];
  /** Games to simulate. */
  remaining_games: readonly ScheduledGame[];
  strengths: StrengthModel;
  rules: TableRules;
  simulations: number;
  seed: number;
  /** Game id -> the side that must win (used for stakes). */
  forced_winners?: ReadonlyMap<string, Side>;
}

export interface TeamOdds {
  team_id: string;
  playoff_probability: number;
  top_spots_probability: number;
  relegation_probability: number;
  expected_points: number;
}

/** Every possible final result of one game with its probability, ready for sampling. */
interface OutcomeTable {
  home_index: number;
  away_index: number;
  home_goals: number[];
  away_goals: number[];
  home_points: number[];
  away_points: number[];
  /** Running total of the probabilities, ends at 1. */
  cumulative: number[];
}

const { points } = season_config;

/**
 * Outcomes: every 60-minute score; a tie becomes an overtime/shootout win for either side
 * (+1 goal for the winner, as in the Liiga table). With a forced winner, only that side's
 * wins are kept and renormalised.
 */
function build_outcome_table(
  game: ScheduledGame,
  strengths: StrengthModel,
  indexes: ReadonlyMap<string, number>,
  forced_winner: Side | undefined,
): OutcomeTable {
  const home_index = indexes.get(game.home_team_id);
  const away_index = indexes.get(game.away_team_id);
  if (home_index === undefined || away_index === undefined) {
    throw new Error(`Game ${game.id} references an unknown team`);
  }
  const probabilities = game_probabilities(
    expected_goals(strengths, game.home_team_id, game.away_team_id),
  );
  const table: OutcomeTable = {
    home_index,
    away_index,
    home_goals: [],
    away_goals: [],
    home_points: [],
    away_points: [],
    cumulative: [],
  };
  const weights: number[] = [];
  const add = (home: number, away: number, home_pts: number, away_pts: number, weight: number) => {
    const winner: Side = home > away ? "home" : "away";
    if (weight <= 0 || (forced_winner && forced_winner !== winner)) {
      return;
    }
    table.home_goals.push(home);
    table.away_goals.push(away);
    table.home_points.push(home_pts);
    table.away_points.push(away_pts);
    weights.push(weight);
  };

  probabilities.score_matrix.forEach((row, home) => {
    row.forEach((probability, away) => {
      if (home > away) {
        add(home, away, points.regulation_win, points.regulation_loss, probability);
      } else if (away > home) {
        add(home, away, points.regulation_loss, points.regulation_win, probability);
      } else {
        const home_share = probabilities.overtime_home_share;
        add(home + 1, away, points.overtime_win, points.overtime_loss, probability * home_share);
        add(
          home,
          away + 1,
          points.overtime_loss,
          points.overtime_win,
          probability * (1 - home_share),
        );
      }
    });
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let running = 0;
  for (const weight of weights) {
    running += weight / total;
    table.cumulative.push(running);
  }
  return table;
}

/** Index of the first cumulative value above u (binary search). */
function sample_index(cumulative: readonly number[], u: number): number {
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (u < (cumulative[middle] ?? 1)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low;
}

interface Table {
  points: Int32Array;
  goals_for: Int32Array;
  goals_against: Int32Array;
}

function starting_table(
  team_count: number,
  played_games: readonly FinishedGame[],
  indexes: ReadonlyMap<string, number>,
): Table {
  const table: Table = {
    points: new Int32Array(team_count),
    goals_for: new Int32Array(team_count),
    goals_against: new Int32Array(team_count),
  };
  for (const game of played_games) {
    const home = indexes.get(game.home_team_id);
    const away = indexes.get(game.away_team_id);
    if (home === undefined || away === undefined) {
      throw new Error(`Played game references an unknown team`);
    }
    const result = get_game_points(game);
    add_result(
      table,
      home,
      away,
      game.home_goals,
      game.away_goals,
      result.home_points,
      result.away_points,
    );
  }
  return table;
}

function add_result(
  table: Table,
  home: number,
  away: number,
  home_goals: number,
  away_goals: number,
  home_points: number,
  away_points: number,
): void {
  table.points[home] = (table.points[home] ?? 0) + home_points;
  table.points[away] = (table.points[away] ?? 0) + away_points;
  table.goals_for[home] = (table.goals_for[home] ?? 0) + home_goals;
  table.goals_for[away] = (table.goals_for[away] ?? 0) + away_goals;
  table.goals_against[home] = (table.goals_against[home] ?? 0) + away_goals;
  table.goals_against[away] = (table.goals_against[away] ?? 0) + home_goals;
}

/**
 * Table order: points, goal difference, goals scored, then a random draw.
 * VERIFY: Liiga's official tie-breakers after goals scored (head-to-head) are not modelled.
 */
function rank_teams(table: Table, tie_breaks: Float64Array): number[] {
  const order = Array.from({ length: table.points.length }, (_, index) => index);
  const value = (array: Int32Array | Float64Array, index: number) => array[index] ?? 0;
  const goal_difference = (index: number) =>
    value(table.goals_for, index) - value(table.goals_against, index);
  return order.sort(
    (first, second) =>
      value(table.points, second) - value(table.points, first) ||
      goal_difference(second) - goal_difference(first) ||
      value(table.goals_for, second) - value(table.goals_for, first) ||
      value(tie_breaks, second) - value(tie_breaks, first),
  );
}

function simulate_once(base: Table, games: readonly OutcomeTable[], rng: Rng): number[] {
  const table: Table = {
    points: base.points.slice(),
    goals_for: base.goals_for.slice(),
    goals_against: base.goals_against.slice(),
  };
  for (const game of games) {
    const outcome = sample_index(game.cumulative, rng());
    add_result(
      table,
      game.home_index,
      game.away_index,
      game.home_goals[outcome] ?? 0,
      game.away_goals[outcome] ?? 0,
      game.home_points[outcome] ?? 0,
      game.away_points[outcome] ?? 0,
    );
  }
  const tie_breaks = new Float64Array(table.points.length);
  for (let index = 0; index < tie_breaks.length; index += 1) {
    tie_breaks[index] = rng();
  }
  return rank_teams(table, tie_breaks);
}

/**
 * Plays the remaining schedule `simulations` times (seeded, so repeatable) and counts how
 * often each team finishes in the playoff spots, the top spots and the relegation spots.
 * Every game uses exactly one random number, so runs with the same seed stay in step
 * (common random numbers): forcing one game's winner changes only that game.
 */
export function simulate_season(input: SimulationInput): TeamOdds[] {
  const team_count = input.team_ids.length;
  const indexes = new Map(input.team_ids.map((team_id, index) => [team_id, index]));
  const base = starting_table(team_count, input.played_games, indexes);
  const games = input.remaining_games.map((game) =>
    build_outcome_table(game, input.strengths, indexes, input.forced_winners?.get(game.id)),
  );
  const relegation_from_rank = team_count - input.rules.relegated_team_count;

  const playoff_counts = new Float64Array(team_count);
  const top_counts = new Float64Array(team_count);
  const relegation_counts = new Float64Array(team_count);
  const point_totals = new Float64Array(team_count);
  const rng = mulberry32(input.seed);

  for (let run = 0; run < input.simulations; run += 1) {
    const order = simulate_once(base, games, rng);
    order.forEach((team_index, rank_index) => {
      if (rank_index < input.rules.playoff_spots) {
        playoff_counts[team_index] = (playoff_counts[team_index] ?? 0) + 1;
      }
      if (rank_index < input.rules.top_spots) {
        top_counts[team_index] = (top_counts[team_index] ?? 0) + 1;
      }
      if (rank_index >= relegation_from_rank) {
        relegation_counts[team_index] = (relegation_counts[team_index] ?? 0) + 1;
      }
    });
  }

  // Expected final points: points so far + expected points of every remaining game.
  for (const game of games) {
    let home_expected = 0;
    let away_expected = 0;
    let previous = 0;
    game.cumulative.forEach((cumulative, index) => {
      const probability = cumulative - previous;
      previous = cumulative;
      home_expected += probability * (game.home_points[index] ?? 0);
      away_expected += probability * (game.away_points[index] ?? 0);
    });
    point_totals[game.home_index] = (point_totals[game.home_index] ?? 0) + home_expected;
    point_totals[game.away_index] = (point_totals[game.away_index] ?? 0) + away_expected;
  }

  return input.team_ids.map((team_id, index) => ({
    team_id,
    playoff_probability: (playoff_counts[index] ?? 0) / input.simulations,
    top_spots_probability: (top_counts[index] ?? 0) / input.simulations,
    relegation_probability: (relegation_counts[index] ?? 0) / input.simulations,
    expected_points: (base.points[index] ?? 0) + (point_totals[index] ?? 0),
  }));
}
