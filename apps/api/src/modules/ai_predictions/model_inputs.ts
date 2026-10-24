import { createHash } from "node:crypto";
import {
  model_config,
  predict_game,
  table_rules,
  type GamePrediction,
  type ModelGoal,
  type ModelPlayer,
  type PlayedGame,
  type PlayerPosition,
  type ScheduledGame,
  type StrengthModel,
} from "@voita_kone/prediction_model";
import { ended_in_schema } from "@voita_kone/shared_types";
import type { ModelGameRow, SeasonRows } from "./model_inputs_repository";

// Turns DB rows into prediction_model inputs. Pure, so it is tested without a database.

export interface SeasonData {
  season: string;
  team_names: ReadonlyMap<string, string>;
  team_ids: string[];
  games: ModelGameRow[];
  /** Finished games, oldest first. */
  played: PlayedGame[];
  players: ModelPlayer[];
  goals: ModelGoal[];
}

const POSITIONS = new Set<string>(["goalie", "defense", "forward"]);

function to_position(value: string | null): PlayerPosition | null {
  return value !== null && POSITIONS.has(value) ? (value as PlayerPosition) : null;
}

export function to_played_game(game: ModelGameRow): PlayedGame | null {
  if (game.status !== "final" || game.home_goals === null || game.away_goals === null) {
    return null;
  }
  const ended_in = ended_in_schema.safeParse(game.ended_in);
  if (!ended_in.success || game.home_goals === game.away_goals) {
    return null;
  }
  return {
    id: game.id,
    start_time: game.start_time,
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    home_goals: game.home_goals,
    away_goals: game.away_goals,
    ended_in: ended_in.data,
  };
}

export function to_scheduled_game(game: ModelGameRow): ScheduledGame {
  return {
    id: game.id,
    start_time: game.start_time,
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
  };
}

export function to_season_data(rows: SeasonRows): SeasonData {
  return {
    season: rows.season,
    team_names: new Map(rows.teams.map((team) => [team.id, team.name])),
    team_ids: rows.teams.map((team) => team.id),
    games: rows.games,
    played: rows.games.map(to_played_game).filter((game): game is PlayedGame => game !== null),
    players: rows.players.map((player) => ({ ...player, position: to_position(player.position) })),
    goals: rows.goals.map((goal) => ({
      game_id: goal.game_id,
      team_id: goal.team_id,
      scorer_id: goal.player_id,
    })),
  };
}

/** Finished games that started before `start_time`: all the model may know before puck drop. */
export function history_before(data: SeasonData, start_time: Date): PlayedGame[] {
  return data.played.filter((game) => game.start_time.getTime() < start_time.getTime());
}

/** Every season game not in the history: the schedule the season simulation plays out. */
export function remaining_games(data: SeasonData, history: readonly PlayedGame[]): ScheduledGame[] {
  const known = new Set(history.map((game) => game.id));
  return data.games.filter((game) => !known.has(game.id)).map(to_scheduled_game);
}

export interface PredictOptions {
  /** Strengths from the same history, to reuse across games of one run. */
  strengths?: StrengthModel;
  stakes_simulations?: number;
  seed?: number;
}

/** The pre-game prediction for one game, from the data before its puck drop only. */
export function predict_from_season(
  data: SeasonData,
  game: ModelGameRow,
  options: PredictOptions = {},
): GamePrediction {
  const history = history_before(data, game.start_time);
  const known = new Set(history.map((played) => played.id));
  return predict_game({
    game: to_scheduled_game(game),
    team_names: data.team_names,
    history,
    remaining_games: remaining_games(data, history),
    players: data.players,
    goals: data.goals.filter((goal) => known.has(goal.game_id)),
    rules: table_rules,
    strengths: options.strengths,
    stakes_simulations: options.stakes_simulations ?? model_config.stakes_simulations,
    seed: options.seed ?? model_config.seed,
  });
}

/** A stable fingerprint of everything a model run reads; an unchanged hash skips the run. */
export function compute_input_hash(
  data: SeasonData,
  target_games: readonly ModelGameRow[],
): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(model_config));
  hash.update(data.season);
  for (const game of data.games) {
    hash.update(
      `${game.id}|${game.start_time.toISOString()}|${game.home_team_id}|${game.away_team_id}|${game.status}|` +
        `${String(game.home_goals)}|${String(game.away_goals)}|${String(game.ended_in)}\n`,
    );
  }
  for (const player of [...data.players].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    hash.update(`${player.id}|${player.team_id}|${String(player.position)}\n`);
  }
  const goal_keys = data.goals.map(
    (goal) => `${goal.game_id}|${goal.team_id}|${String(goal.scorer_id)}`,
  );
  hash.update(goal_keys.sort().join("\n"));
  hash.update(target_games.map((game) => game.id).join(","));
  return hash.digest("hex");
}
