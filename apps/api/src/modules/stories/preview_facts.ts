import type {
  PreviewFactSheetInput,
  PreviewMeeting,
  PreviewTeamFacts,
} from "@voita_kone/fact_checker";
import { FORM_GAMES } from "@voita_kone/fact_checker";
import {
  compute_standings,
  model_config,
  type GamePrediction,
  type PlayedGame,
} from "@voita_kone/prediction_model";
import { history_before, type SeasonData } from "../ai_predictions/model_inputs";

// Turns the season (as of puck drop), the last meetings and the model's numbers into the
// preview fact sheet input. Pure: every number is counted here or by prediction_model.

export interface PreviewGame {
  id: string;
  start_time: Date;
  home_team_id: string;
  away_team_id: string;
}

function team_won(game: PlayedGame, team_id: string): boolean {
  // A finished Liiga game always has a winner (overtime and shootout decide it).
  const home_won = game.home_goals > game.away_goals;
  return game.home_team_id === team_id ? home_won : !home_won;
}

function plays_in(game: PlayedGame, team_id: string): boolean {
  return game.home_team_id === team_id || game.away_team_id === team_id;
}

/** The team's last 5 finished games, oldest first. */
export function last_games(history: readonly PlayedGame[], team_id: string): PlayedGame[] {
  return history.filter((game) => plays_in(game, team_id)).slice(-FORM_GAMES);
}

export function form_of(history: readonly PlayedGame[], team_id: string): string {
  return last_games(history, team_id)
    .map((game) => (team_won(game, team_id) ? "W" : "L"))
    .join("");
}

export function venue_record_of(
  history: readonly PlayedGame[],
  team_id: string,
  venue: "home" | "away",
): { wins: number; losses: number } {
  const games = history.filter((game) =>
    venue === "home" ? game.home_team_id === team_id : game.away_team_id === team_id,
  );
  const wins = games.filter((game) => team_won(game, team_id)).length;
  return { wins, losses: games.length - wins };
}

/** The player with the most goals in the team's last 5 games (first to reach it on a tie). */
export function top_scorer_of(
  data: SeasonData,
  history: readonly PlayedGame[],
  team_id: string,
): { player: string; goals: number } | null {
  const game_ids = new Set(last_games(history, team_id).map((game) => game.id));
  const counts = new Map<string, number>();
  for (const goal of data.goals) {
    if (goal.team_id === team_id && goal.scorer_id && game_ids.has(goal.game_id)) {
      counts.set(goal.scorer_id, (counts.get(goal.scorer_id) ?? 0) + 1);
    }
  }
  const best = [...counts.entries()].sort((first, second) => second[1] - first[1])[0];
  const player = best ? data.players.find((candidate) => candidate.id === best[0]) : undefined;
  return best && player
    ? { player: `${player.first_name} ${player.last_name}`, goals: best[1] }
    : null;
}

function team_facts(
  data: SeasonData,
  history: readonly PlayedGame[],
  team_id: string,
  venue: "home" | "away",
  prediction: GamePrediction | null,
): PreviewTeamFacts {
  const table = compute_standings(data.team_ids, history).find((row) => row.team_id === team_id);
  const stake = prediction?.stakes.highlights.find((candidate) => candidate.team_id === team_id);
  return {
    team: data.team_names.get(team_id) ?? team_id,
    form: form_of(history, team_id),
    venue_record: venue_record_of(history, team_id, venue),
    table:
      table && table.games_played > 0
        ? { rank: table.rank, points: table.points, games_played: table.games_played }
        : null,
    top_scorer: top_scorer_of(data, history, team_id),
    stake: stake ? { kind: stake.kind, if_win: stake.if_win, if_loss: stake.if_loss } : null,
  };
}

export function to_preview_input(
  data: SeasonData,
  game: PreviewGame,
  meetings: readonly PreviewMeeting[],
  prediction: GamePrediction | null,
  built_at: Date,
): PreviewFactSheetInput {
  const history = history_before(data, game.start_time);
  return {
    game_id: game.id,
    built_at: built_at.toISOString(),
    home: team_facts(data, history, game.home_team_id, "home", prediction),
    away: team_facts(data, history, game.away_team_id, "away", prediction),
    meetings,
    win_chance: prediction
      ? { home_win: prediction.home_win_probability, away_win: prediction.away_win_probability }
      : null,
    model_source: `prediction_model:${model_config.model_version}`,
  };
}
