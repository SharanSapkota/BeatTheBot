import { expected_goals, game_probabilities } from "./game_probabilities";
import type { ExpectedGoals, PlayedGame, ScheduledGame } from "./model_types";
import { build_reasons, type Reason } from "./reasons";
import { model_config, type TableRules } from "./season_config";
import { compute_stakes, type GameStakes } from "./stakes";
import { compute_team_strengths, type StrengthModel } from "./team_strength";
import {
  pick_top_scorer,
  type ModelGoal,
  type ModelPlayer,
  type ScorerPick,
} from "./top_scorer_pick";

export interface PredictGameInput {
  game: ScheduledGame;
  /** Team id -> display name, for the reason texts. */
  team_names: ReadonlyMap<string, string>;
  /** Finished games before puck drop. Nothing after it is used. */
  history: readonly PlayedGame[];
  /** Every season game not in `history` (includes `game`). */
  remaining_games: readonly ScheduledGame[];
  players: readonly ModelPlayer[];
  goals: readonly ModelGoal[];
  rules: TableRules;
  stakes_simulations?: number;
  seed?: number;
  /** Strengths from the same history, when the caller already has them. */
  strengths?: StrengthModel;
}

export interface GamePrediction {
  game_id: string;
  home_win_probability: number;
  away_win_probability: number;
  overtime_probability: number;
  expected_goals: ExpectedGoals;
  overtime_home_share: number;
  predicted_winner_team_id: string;
  predicted_home_goals: number;
  predicted_away_goals: number;
  scorer: ScorerPick | null;
  reasons: Reason[];
  stakes: GameStakes;
}

function player_name(players: readonly ModelPlayer[], player_id: string): string | null {
  const player = players.find((candidate) => candidate.id === player_id);
  return player ? `${player.first_name} ${player.last_name}` : null;
}

function team_name(names: ReadonlyMap<string, string>, team_id: string): string {
  const name = names.get(team_id);
  if (!name) {
    throw new Error(`No name for team ${team_id}`);
  }
  return name;
}

/** The AI's pre-game pick for one game: odds, score, scorer, 3 reasons and the stakes. */
export function predict_game(input: PredictGameInput): GamePrediction {
  const { game } = input;
  const team_ids = [...input.team_names.keys()];
  const strengths = input.strengths ?? compute_team_strengths(team_ids, input.history);
  const probabilities = game_probabilities(
    expected_goals(strengths, game.home_team_id, game.away_team_id),
  );
  const predicted_winner_team_id =
    probabilities.predicted_winner === "home" ? game.home_team_id : game.away_team_id;
  const scorer = pick_top_scorer({
    team_id: predicted_winner_team_id,
    players: input.players,
    history: input.history,
    goals: input.goals,
  });
  const reasons = build_reasons({
    home_team: { id: game.home_team_id, name: team_name(input.team_names, game.home_team_id) },
    away_team: { id: game.away_team_id, name: team_name(input.team_names, game.away_team_id) },
    predicted_winner_team_id,
    team_ids,
    history: input.history,
    scorer,
    scorer_name: scorer ? player_name(input.players, scorer.player_id) : null,
  });
  const stakes = compute_stakes(
    {
      team_ids,
      played_games: input.history,
      remaining_games: input.remaining_games,
      strengths,
      rules: input.rules,
      simulations: input.stakes_simulations ?? model_config.stakes_simulations,
      seed: input.seed ?? model_config.seed,
    },
    game,
  );

  return {
    game_id: game.id,
    home_win_probability: probabilities.home_win,
    away_win_probability: probabilities.away_win,
    overtime_probability: probabilities.overtime,
    expected_goals: probabilities.expected_goals,
    overtime_home_share: probabilities.overtime_home_share,
    predicted_winner_team_id,
    predicted_home_goals: probabilities.predicted_score.home,
    predicted_away_goals: probabilities.predicted_score.away,
    scorer,
    reasons,
    stakes,
  };
}
