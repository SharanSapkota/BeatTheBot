import type {
  EndedIn,
  FactSheetGoal,
  FactSheetInput,
  FactSheetNextGame,
  FactSheetOdds,
  FactSheetStanding,
  KnownName,
  OddsByKind,
} from "@voita_kone/fact_checker";
import {
  compute_standings,
  compute_team_strengths,
  model_config,
  simulate_season,
  table_rules,
  type PlayedGame,
  type TeamOdds,
} from "@voita_kone/prediction_model";
import { to_helsinki_date } from "../../common/helsinki_date";
import { history_before, remaining_games, type SeasonData } from "../ai_predictions/model_inputs";

// Turns the game and the season into fact sheet input. Every number is computed here or by
// prediction_model: standings and season odds as of puck drop ("before") and after this game.

export interface StoryGame {
  id: string;
  start_time: Date;
  home_team_id: string;
  away_team_id: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  ended_in: EndedIn;
}

export interface StoryGoalRow {
  team_id: string;
  period: number;
  game_time_seconds: number;
  player_name: string | null;
}

export interface SeasonFacts {
  standings: FactSheetStanding[];
  odds: FactSheetOdds[];
  next_games: FactSheetNextGame[];
}

const NO_SEASON_FACTS: SeasonFacts = { standings: [], odds: [], next_games: [] };

function to_odds_by_kind(odds: TeamOdds): OddsByKind {
  return {
    playoffs: odds.playoff_probability,
    top_4: odds.top_spots_probability,
    relegation: odds.relegation_probability,
  };
}

function simulate(
  data: SeasonData,
  history: readonly PlayedGame[],
  simulations: number,
): TeamOdds[] {
  return simulate_season({
    team_ids: data.team_ids,
    played_games: history,
    remaining_games: remaining_games(data, history),
    strengths: compute_team_strengths(data.team_ids, history),
    rules: table_rules,
    simulations,
    seed: model_config.seed,
  });
}

/**
 * Standings, season odds and next games for both teams, before and after the game (and the
 * other games of its time slot). Empty for a game the season data doesn't have (demo
 * fill-ins never feed the model).
 */
export function compute_season_facts(
  data: SeasonData,
  game: StoryGame,
  simulations: number = model_config.season_simulations,
): SeasonFacts {
  const played = data.played.find((candidate) => candidate.id === game.id);
  if (!played) {
    return NO_SEASON_FACTS;
  }
  // Before: games that started before this one. After: also the games of the same time slot
  // (a Liiga evening plays most games at 18:30), so the table is the one after the evening.
  const before = history_before(data, game.start_time);
  const after = data.played.filter(
    (candidate) => candidate.start_time.getTime() <= played.start_time.getTime(),
  );
  const table_before = compute_standings(data.team_ids, before);
  const table_after = compute_standings(data.team_ids, after);
  const odds_before = simulate(data, before, simulations);
  const odds_after = simulate(data, after, simulations);
  const name_of = (team_id: string) => data.team_names.get(team_id) ?? team_id;

  const team_ids = [game.home_team_id, game.away_team_id];
  const standings = team_ids.flatMap((team_id) => {
    const row_before = table_before.find((row) => row.team_id === team_id);
    const row_after = table_after.find((row) => row.team_id === team_id);
    return row_before && row_after
      ? [
          {
            team: name_of(team_id),
            rank_before: row_before.rank,
            rank_after: row_after.rank,
            points_before: row_before.points,
            points_after: row_after.points,
          },
        ]
      : [];
  });
  const odds = team_ids.flatMap((team_id) => {
    const team_before = odds_before.find((row) => row.team_id === team_id);
    const team_after = odds_after.find((row) => row.team_id === team_id);
    return team_before && team_after
      ? [
          {
            team: name_of(team_id),
            before: to_odds_by_kind(team_before),
            after: to_odds_by_kind(team_after),
          },
        ]
      : [];
  });
  const next_games = team_ids.flatMap((team_id) => {
    const next = data.games
      .filter(
        (candidate) =>
          candidate.status === "scheduled" &&
          candidate.start_time > game.start_time &&
          (candidate.home_team_id === team_id || candidate.away_team_id === team_id),
      )
      .sort((first, second) => first.start_time.getTime() - second.start_time.getTime())[0];
    if (!next) {
      return [];
    }
    const is_home = next.home_team_id === team_id;
    return [
      {
        team: name_of(team_id),
        opponent: name_of(is_home ? next.away_team_id : next.home_team_id),
        venue: is_home ? ("home" as const) : ("away" as const),
        date: to_helsinki_date(next.start_time),
      },
    ];
  });
  return { standings, odds, next_games };
}

export function to_fact_sheet_input(
  game: StoryGame,
  goals: readonly StoryGoalRow[],
  season_facts: SeasonFacts,
  built_at: Date,
): FactSheetInput {
  const team_name = (team_id: string) =>
    team_id === game.home_team_id ? game.home_team : game.away_team;
  const sheet_goals: FactSheetGoal[] = goals.map((goal) => ({
    player: goal.player_name,
    team: team_name(goal.team_id),
    period: goal.period,
    game_time_seconds: goal.game_time_seconds,
  }));
  return {
    game_id: game.id,
    built_at: built_at.toISOString(),
    date: to_helsinki_date(game.start_time),
    home_team: game.home_team,
    away_team: game.away_team,
    home_goals: game.home_goals,
    away_goals: game.away_goals,
    ended_in: game.ended_in,
    goals: sheet_goals,
    ...season_facts,
    odds_source: `prediction_model:${model_config.model_version}`,
  };
}

/** Every real team and player of the season: a name outside the fact sheet fails the check. */
export function known_names_of(data: SeasonData): KnownName[] {
  return [
    ...[...data.team_names.values()].map((name) => ({ name, kind: "team" as const })),
    ...data.players.map((player) => ({
      name: `${player.first_name} ${player.last_name}`,
      kind: "player" as const,
    })),
  ];
}
