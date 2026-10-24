import type {
  FactSheetInput,
  FactSheetNextGame,
  FactSheetStanding,
  PreviewFactSheetInput,
  PreviewMeeting,
  PreviewTeamFacts,
} from "@voita_kone/fact_checker";
import { FORM_GAMES } from "@voita_kone/fact_checker";
import { to_helsinki_date } from "../../common/helsinki_date";
import type { StoryGoalRow } from "./fact_sheet_input";

// Facts for football and basketball (no data API yet: the sample fixtures are their data for
// now). Only what the games table holds: results, scorers, a table counted from the results,
// form, records, meetings and the next game. No model numbers. Pure, so it is tested without a
// database.

/** One game of the league season, as the facts need it. */
export interface LeagueGame {
  id: string;
  start_time: Date;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
}

export type SampleSport = "football" | "basketball";

/** Points per result: football 3 / 1 / 0, basketball 2 for a win. */
const POINTS: Record<SampleSport, { win: number; draw: number }> = {
  football: { win: 3, draw: 1 },
  basketball: { win: 2, draw: 0 },
};

export interface PlayedGame extends LeagueGame {
  home_goals: number;
  away_goals: number;
}

/** A final with a score. */
export function is_played(game: LeagueGame): game is PlayedGame {
  return game.status === "final" && game.home_goals !== null && game.away_goals !== null;
}

function plays_in(game: LeagueGame, team_id: string): boolean {
  return game.home_team_id === team_id || game.away_team_id === team_id;
}

/** "W", "D" or "L" for the team. */
function result_for(game: PlayedGame, team_id: string): "W" | "D" | "L" {
  if (game.home_goals === game.away_goals) {
    return "D";
  }
  const home_won = game.home_goals > game.away_goals;
  return (game.home_team_id === team_id) === home_won ? "W" : "L";
}

/** Finished games that started before `before`, oldest first. */
export function played_before(games: readonly LeagueGame[], before: Date): PlayedGame[] {
  return games
    .filter(is_played)
    .filter((game) => game.start_time < before)
    .sort((first, second) => first.start_time.getTime() - second.start_time.getTime());
}

export interface TableRow {
  team_id: string;
  rank: number;
  points: number;
  games_played: number;
}

/** The table from the results: points, then goal (point) difference, then goals for. */
export function table_of(played: readonly PlayedGame[], sport: SampleSport): TableRow[] {
  const rows = new Map<string, { points: number; games: number; diff: number; scored: number }>();
  const row_of = (team_id: string) => {
    const existing = rows.get(team_id) ?? { points: 0, games: 0, diff: 0, scored: 0 };
    rows.set(team_id, existing);
    return existing;
  };
  for (const game of played) {
    for (const side of ["home", "away"] as const) {
      const team_id = side === "home" ? game.home_team_id : game.away_team_id;
      const scored = side === "home" ? game.home_goals : game.away_goals;
      const conceded = side === "home" ? game.away_goals : game.home_goals;
      const row = row_of(team_id);
      const result = result_for(game, team_id);
      row.points += result === "W" ? POINTS[sport].win : result === "D" ? POINTS[sport].draw : 0;
      row.games += 1;
      row.diff += scored - conceded;
      row.scored += scored;
    }
  }
  return [...rows.entries()]
    .sort(
      ([, first], [, second]) =>
        second.points - first.points || second.diff - first.diff || second.scored - first.scored,
    )
    .map(([team_id, row], index) => ({
      team_id,
      rank: index + 1,
      points: row.points,
      games_played: row.games,
    }));
}

/** Last 5 results ("WDLWW"), oldest first. */
export function form_of(played: readonly PlayedGame[], team_id: string): string {
  return played
    .filter((game) => plays_in(game, team_id))
    .slice(-FORM_GAMES)
    .map((game) => result_for(game, team_id))
    .join("");
}

function venue_record(
  played: readonly PlayedGame[],
  team_id: string,
  venue: "home" | "away",
): { wins: number; draws: number; losses: number } {
  const games = played.filter((game) =>
    venue === "home" ? game.home_team_id === team_id : game.away_team_id === team_id,
  );
  const results = games.map((game) => result_for(game, team_id));
  return {
    wins: results.filter((result) => result === "W").length,
    draws: results.filter((result) => result === "D").length,
    losses: results.filter((result) => result === "L").length,
  };
}

/** Football: the player with the most goals in the team's last 5 games. */
function top_scorer_of(
  played: readonly PlayedGame[],
  goals: readonly (StoryGoalRow & { game_id: string })[],
  team_id: string,
): { player: string; goals: number } | null {
  const game_ids = new Set(
    played
      .filter((game) => plays_in(game, team_id))
      .slice(-FORM_GAMES)
      .map((game) => game.id),
  );
  const counts = new Map<string, number>();
  for (const goal of goals) {
    if (goal.team_id === team_id && goal.player_name && game_ids.has(goal.game_id)) {
      counts.set(goal.player_name, (counts.get(goal.player_name) ?? 0) + 1);
    }
  }
  const best = [...counts.entries()].sort((first, second) => second[1] - first[1])[0];
  return best ? { player: best[0], goals: best[1] } : null;
}

/** This season's meetings so far, from the home team's view; null when none. */
function season_series_of(
  played: readonly PlayedGame[],
  home_team_id: string,
  away_team_id: string,
): PreviewFactSheetInput["season_series"] {
  const meetings = played.filter(
    (game) => plays_in(game, home_team_id) && plays_in(game, away_team_id),
  );
  if (meetings.length === 0) {
    return null;
  }
  const results = meetings.map((game) => result_for(game, home_team_id));
  return {
    home_team_wins: results.filter((result) => result === "W").length,
    away_team_wins: results.filter((result) => result === "L").length,
    draws: results.filter((result) => result === "D").length,
  };
}

export interface SamplePreviewInput {
  game: LeagueGame;
  sport: SampleSport;
  season_games: readonly LeagueGame[];
  goals: readonly (StoryGoalRow & { game_id: string })[];
  meetings: readonly PreviewMeeting[];
  built_at: Date;
}

export function sample_preview_input(input: SamplePreviewInput): PreviewFactSheetInput {
  const { game, sport } = input;
  const played = played_before(input.season_games, game.start_time);
  const table = table_of(played, sport);
  const team = (team_id: string, name: string, venue: "home" | "away"): PreviewTeamFacts => {
    const row = table.find((candidate) => candidate.team_id === team_id);
    return {
      team: name,
      form: form_of(played, team_id),
      venue_record: venue_record(played, team_id, venue),
      table: row ? { rank: row.rank, points: row.points, games_played: row.games_played } : null,
      top_scorer: sport === "football" ? top_scorer_of(played, input.goals, team_id) : null,
      stake: null,
    };
  };
  return {
    game_id: game.id,
    built_at: input.built_at.toISOString(),
    home: team(game.home_team_id, game.home_team, "home"),
    away: team(game.away_team_id, game.away_team, "away"),
    meetings: input.meetings,
    win_chance: null,
    model_source: "derived",
    season_series: season_series_of(played, game.home_team_id, game.away_team_id),
    data_source: "sample_data",
  };
}

/** Each team's next game after `after`. */
export function next_games_of(
  season_games: readonly LeagueGame[],
  game: LeagueGame,
): FactSheetNextGame[] {
  return [
    [game.home_team_id, game.home_team],
    [game.away_team_id, game.away_team],
  ].flatMap(([team_id = "", team = ""]) => {
    const next = season_games
      .filter((candidate) => candidate.start_time > game.start_time && plays_in(candidate, team_id))
      .sort((first, second) => first.start_time.getTime() - second.start_time.getTime())[0];
    if (!next) {
      return [];
    }
    const is_home = next.home_team_id === team_id;
    return [
      {
        team,
        opponent: is_home ? next.away_team : next.home_team,
        venue: is_home ? ("home" as const) : ("away" as const),
        date: to_helsinki_date(next.start_time),
      },
    ];
  });
}

export interface SampleSummaryInput {
  game: PlayedGame;
  sport: SampleSport;
  season_games: readonly LeagueGame[];
  goals: readonly StoryGoalRow[];
  built_at: Date;
}

/** The table before and after the game for both teams. */
function standings_of(input: SampleSummaryInput): FactSheetStanding[] {
  const before = table_of(played_before(input.season_games, input.game.start_time), input.sport);
  const after = table_of(
    played_before(input.season_games, new Date(input.game.start_time.getTime() + 1)),
    input.sport,
  );
  return [
    [input.game.home_team_id, input.game.home_team],
    [input.game.away_team_id, input.game.away_team],
  ].flatMap(([team_id = "", team = ""]) => {
    const row_after = after.find((row) => row.team_id === team_id);
    if (!row_after) {
      return [];
    }
    const row_before = before.find((row) => row.team_id === team_id);
    return [
      {
        team,
        // A team's first game: it entered the table at the bottom.
        rank_before: row_before?.rank ?? after.length,
        rank_after: row_after.rank,
        points_before: row_before?.points ?? 0,
        points_after: row_after.points,
      },
    ];
  });
}

export function sample_summary_input(input: SampleSummaryInput): FactSheetInput {
  const { game } = input;
  const names = new Map([
    [game.home_team_id, game.home_team],
    [game.away_team_id, game.away_team],
  ]);
  return {
    game_id: game.id,
    built_at: input.built_at.toISOString(),
    date: to_helsinki_date(game.start_time),
    home_team: game.home_team,
    away_team: game.away_team,
    home_goals: game.home_goals,
    away_goals: game.away_goals,
    ended_in: "regulation",
    goals: input.goals.map((goal) => ({
      player: goal.player_name,
      team: names.get(goal.team_id) ?? "",
      period: goal.period,
      game_time_seconds: goal.game_time_seconds,
    })),
    standings: standings_of(input),
    odds: [],
    odds_source: "derived",
    next_games: next_games_of(input.season_games, game),
    data_source: "sample_data",
  };
}
