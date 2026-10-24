import type { PlayedGame } from "./model_types";
import { recent_team_games, type ScorerPick } from "./top_scorer_pick";
import { compute_standings } from "./standings";

// Reasons are FACTS computed from Liiga data, never free text: each has a fact_id, its
// values and an English sentence filled from a fixed template with exactly those values.

export type ReasonType =
  | "venue_record"
  | "venue_scoring"
  | "goals_for"
  | "goals_against"
  | "scorer_form"
  | "head_to_head"
  | "streak"
  | "table_position";

export type ReasonValues = Record<string, number | string>;

export interface Reason {
  fact_id: string;
  type: ReasonType;
  /** The team the fact is about. */
  team_id: string;
  values: ReasonValues;
  text_en: string;
  /** How far the fact is from a normal team (0 = average). Used to choose the top 3. */
  relevance: number;
  /** The team the fact speaks for. */
  favours_team_id: string;
}

export interface ReasonTeam {
  id: string;
  name: string;
}

export interface ReasonInput {
  home_team: ReasonTeam;
  away_team: ReasonTeam;
  predicted_winner_team_id: string;
  team_ids: readonly string[];
  /** Finished games before the game, this season. */
  history: readonly PlayedGame[];
  scorer: ScorerPick | null;
  scorer_name: string | null;
  max_reasons?: number;
}

const RECENT_GAMES = 5;
const MIN_GAMES = 3;
const MIN_RELEVANCE = 0.05;
const MIN_STREAK = 3;
const MIN_SCORER_GOALS = 3;

interface Context {
  input: ReasonInput;
  league_goals_per_team: number;
  league_home_win_rate: number;
}

function one_decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function format_decimal(value: number): string {
  return one_decimal(value).toFixed(1);
}

function ordinal(rank: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const last_two = rank % 100;
  const suffix = last_two >= 11 && last_two <= 13 ? "th" : (suffixes[rank % 10] ?? "th");
  return `${String(rank)}${suffix}`;
}

function opponent_of(context: Context, team_id: string): ReasonTeam {
  const { home_team, away_team } = context.input;
  return team_id === home_team.id ? away_team : home_team;
}

function team_of(context: Context, team_id: string): ReasonTeam {
  const { home_team, away_team } = context.input;
  return team_id === home_team.id ? home_team : away_team;
}

function won(game: PlayedGame, team_id: string): boolean {
  const home_won = game.home_goals > game.away_goals;
  return game.home_team_id === team_id ? home_won : !home_won;
}

function team_goals(game: PlayedGame, team_id: string): { for: number; against: number } {
  return game.home_team_id === team_id
    ? { for: game.home_goals, against: game.away_goals }
    : { for: game.away_goals, against: game.home_goals };
}

function venue_games(history: readonly PlayedGame[], team_id: string, venue: "home" | "away") {
  return history.filter((game) =>
    venue === "home" ? game.home_team_id === team_id : game.away_team_id === team_id,
  );
}

function newest_first(games: readonly PlayedGame[]): PlayedGame[] {
  return [...games].sort(
    (first, second) => second.start_time.getTime() - first.start_time.getTime(),
  );
}

/** "Kärpät won 4 of their last 5 home games." */
function venue_record(context: Context, team_id: string, venue: "home" | "away"): Reason | null {
  const games = newest_first(venue_games(context.input.history, team_id, venue)).slice(
    0,
    RECENT_GAMES,
  );
  if (games.length < MIN_GAMES) {
    return null;
  }
  const wins = games.filter((game) => won(game, team_id)).length;
  const league_rate =
    venue === "home" ? context.league_home_win_rate : 1 - context.league_home_win_rate;
  const rate = wins / games.length;
  const team = team_of(context, team_id);
  const only = rate < league_rate ? "only " : "";
  return {
    fact_id: `venue_record:${venue}:${team_id}`,
    type: "venue_record",
    team_id,
    values: { team: team.name, venue, wins, games: games.length },
    text_en: `${team.name} won ${only}${String(wins)} of their last ${String(games.length)} ${venue} games.`,
    relevance: Math.abs(rate - league_rate),
    favours_team_id: rate >= league_rate ? team_id : opponent_of(context, team_id).id,
  };
}

function goals_per_game(games: readonly PlayedGame[], team_id: string): number {
  const total = games.reduce((sum, game) => sum + team_goals(game, team_id).for, 0);
  return total / games.length;
}

/** "Ilves have scored 2.1 goals per game away, below their home average of 3.0." */
function venue_scoring(context: Context, team_id: string, venue: "home" | "away"): Reason | null {
  const other_venue = venue === "home" ? "away" : "home";
  const here = venue_games(context.input.history, team_id, venue);
  const there = venue_games(context.input.history, team_id, other_venue);
  if (here.length < MIN_GAMES || there.length < MIN_GAMES) {
    return null;
  }
  const here_average = one_decimal(goals_per_game(here, team_id));
  const there_average = one_decimal(goals_per_game(there, team_id));
  if (here_average === there_average) {
    return null;
  }
  const team = team_of(context, team_id);
  const direction = here_average < there_average ? "below" : "above";
  return {
    fact_id: `venue_scoring:${venue}:${team_id}`,
    type: "venue_scoring",
    team_id,
    values: {
      team: team.name,
      venue,
      goals_per_game: here_average,
      other_venue_goals_per_game: there_average,
    },
    text_en:
      `${team.name} have scored ${format_decimal(here_average)} goals per game ${venue}, ` +
      `${direction} their ${other_venue} average of ${format_decimal(there_average)}.`,
    relevance: Math.abs(here_average - there_average) / context.league_goals_per_team,
    favours_team_id: here_average > there_average ? team_id : opponent_of(context, team_id).id,
  };
}

function team_games(history: readonly PlayedGame[], team_id: string): PlayedGame[] {
  return history.filter((game) => game.home_team_id === team_id || game.away_team_id === team_id);
}

/** "Kärpät score 3.4 goals per game; the league average is 2.9." */
function goals_for(context: Context, team_id: string): Reason | null {
  const games = team_games(context.input.history, team_id);
  if (games.length < RECENT_GAMES) {
    return null;
  }
  const average = one_decimal(goals_per_game(games, team_id));
  const league = one_decimal(context.league_goals_per_team);
  const team = team_of(context, team_id);
  return {
    fact_id: `goals_for:${team_id}`,
    type: "goals_for",
    team_id,
    values: { team: team.name, goals_per_game: average, league_goals_per_game: league },
    text_en: `${team.name} score ${format_decimal(average)} goals per game; the league average is ${format_decimal(league)}.`,
    relevance: Math.abs(average - league) / league,
    favours_team_id: average >= league ? team_id : opponent_of(context, team_id).id,
  };
}

/** "Ilves let in 3.5 goals per game; the league average is 2.9." */
function goals_against(context: Context, team_id: string): Reason | null {
  const games = team_games(context.input.history, team_id);
  if (games.length < RECENT_GAMES) {
    return null;
  }
  const total = games.reduce((sum, game) => sum + team_goals(game, team_id).against, 0);
  const average = one_decimal(total / games.length);
  const league = one_decimal(context.league_goals_per_team);
  const team = team_of(context, team_id);
  return {
    fact_id: `goals_against:${team_id}`,
    type: "goals_against",
    team_id,
    values: { team: team.name, goals_against_per_game: average, league_goals_per_game: league },
    text_en: `${team.name} let in ${format_decimal(average)} goals per game; the league average is ${format_decimal(league)}.`,
    relevance: Math.abs(average - league) / league,
    favours_team_id: average <= league ? team_id : opponent_of(context, team_id).id,
  };
}

/** "Eetu Laine has 5 goals in Kärpät's last 5 games." */
function scorer_form(context: Context): Reason | null {
  const { scorer, scorer_name } = context.input;
  if (!scorer || !scorer_name || scorer.recent_goals < MIN_SCORER_GOALS) {
    return null;
  }
  const team = team_of(context, scorer.team_id);
  return {
    fact_id: `scorer_form:${scorer.player_id}`,
    type: "scorer_form",
    team_id: scorer.team_id,
    values: {
      team: team.name,
      player: scorer_name,
      player_id: scorer.player_id,
      goals: scorer.recent_goals,
      games: scorer.recent_games,
    },
    text_en: `${scorer_name} has ${String(scorer.recent_goals)} goals in ${team.name}'s last ${String(scorer.recent_games)} games.`,
    relevance: scorer.goals_per_game / 2,
    favours_team_id: scorer.team_id,
  };
}

/** "Kärpät won both games against Ilves this season (5–2, 3–1)." Only when one team won all. */
function head_to_head(context: Context): Reason | null {
  const { home_team, away_team, history } = context.input;
  const meetings = newest_first(
    history.filter(
      (game) =>
        (game.home_team_id === home_team.id && game.away_team_id === away_team.id) ||
        (game.home_team_id === away_team.id && game.away_team_id === home_team.id),
    ),
  );
  if (meetings.length === 0) {
    return null;
  }
  const winner = [home_team, away_team].find((team) =>
    meetings.every((game) => won(game, team.id)),
  );
  if (!winner) {
    return null;
  }
  const loser = opponent_of(context, winner.id);
  const scores = meetings.map((game) => {
    const goals = team_goals(game, winner.id);
    return `${String(goals.for)}–${String(goals.against)}`;
  });
  const games_text =
    meetings.length === 1
      ? "the only game"
      : meetings.length === 2
        ? "both games"
        : `all ${String(meetings.length)} games`;
  return {
    fact_id: `head_to_head:${winner.id}:${loser.id}`,
    type: "head_to_head",
    team_id: winner.id,
    values: {
      team: winner.name,
      opponent: loser.name,
      wins: meetings.length,
      scores: scores.join(", "),
    },
    text_en: `${winner.name} won ${games_text} against ${loser.name} this season (${scores.join(", ")}).`,
    relevance: 0.08 * meetings.length,
    favours_team_id: winner.id,
  };
}

/** "Kärpät have won their last 4 games." / "Ilves have lost their last 3 games." */
function streak(context: Context, team_id: string): Reason | null {
  const games = recent_team_games(team_id, context.input.history, context.input.history.length);
  const first = games[0];
  if (!first) {
    return null;
  }
  const is_winning = won(first, team_id);
  const length = games.findIndex((game) => won(game, team_id) !== is_winning);
  const streak_length = length === -1 ? games.length : length;
  if (streak_length < MIN_STREAK) {
    return null;
  }
  const team = team_of(context, team_id);
  return {
    fact_id: `streak:${team_id}`,
    type: "streak",
    team_id,
    values: { team: team.name, result: is_winning ? "won" : "lost", games: streak_length },
    text_en: `${team.name} have ${is_winning ? "won" : "lost"} their last ${String(streak_length)} games.`,
    relevance: 0.05 * streak_length,
    favours_team_id: is_winning ? team_id : opponent_of(context, team_id).id,
  };
}

/** "Kärpät are 3rd in the table, Ilves 15th." */
function table_position(context: Context): Reason | null {
  const { home_team, away_team, team_ids, history } = context.input;
  const standings = compute_standings(team_ids, history);
  const home_row = standings.find((row) => row.team_id === home_team.id);
  const away_row = standings.find((row) => row.team_id === away_team.id);
  if (
    !home_row ||
    !away_row ||
    home_row.games_played < RECENT_GAMES ||
    away_row.games_played < RECENT_GAMES
  ) {
    return null;
  }
  const [better, worse] =
    home_row.rank < away_row.rank ? [home_row, away_row] : [away_row, home_row];
  const better_team = team_of(context, better.team_id);
  const worse_team = team_of(context, worse.team_id);
  return {
    fact_id: `table_position:${better.team_id}:${worse.team_id}`,
    type: "table_position",
    team_id: better.team_id,
    values: {
      team: better_team.name,
      rank: better.rank,
      points: better.points,
      opponent: worse_team.name,
      opponent_rank: worse.rank,
      opponent_points: worse.points,
    },
    text_en: `${better_team.name} are ${ordinal(better.rank)} in the table with ${String(better.points)} points, ${worse_team.name} ${ordinal(worse.rank)} with ${String(worse.points)}.`,
    relevance: (worse.rank - better.rank) / (2 * team_ids.length),
    favours_team_id: better.team_id,
  };
}

function build_context(input: ReasonInput): Context {
  const games = input.history;
  const goals = games.reduce((sum, game) => sum + game.home_goals + game.away_goals, 0);
  const home_wins = games.filter((game) => game.home_goals > game.away_goals).length;
  return {
    input,
    league_goals_per_team: games.length > 0 ? goals / (2 * games.length) : 1,
    league_home_win_rate: games.length > 0 ? home_wins / games.length : 0.5,
  };
}

/** Every reason the data supports, for both teams. */
export function all_reasons(input: ReasonInput): Reason[] {
  const context = build_context(input);
  const { home_team, away_team } = input;
  const candidates = [
    venue_record(context, home_team.id, "home"),
    venue_record(context, away_team.id, "away"),
    venue_scoring(context, home_team.id, "home"),
    venue_scoring(context, away_team.id, "away"),
    goals_for(context, home_team.id),
    goals_for(context, away_team.id),
    goals_against(context, home_team.id),
    goals_against(context, away_team.id),
    scorer_form(context),
    head_to_head(context),
    streak(context, home_team.id),
    streak(context, away_team.id),
    table_position(context),
  ];
  return candidates.filter((reason): reason is Reason => reason !== null);
}

/**
 * Up to 3 reasons that support the AI's pick, most relevant first, one per type.
 * Fewer than 3 when the data does not support more.
 */
export function build_reasons(input: ReasonInput): Reason[] {
  const supporting = all_reasons(input)
    .filter((reason) => reason.favours_team_id === input.predicted_winner_team_id)
    .filter((reason) => reason.relevance >= MIN_RELEVANCE)
    .sort((first, second) => second.relevance - first.relevance);
  const chosen: Reason[] = [];
  for (const reason of supporting) {
    if (!chosen.some((other) => other.type === reason.type)) {
      chosen.push(reason);
    }
  }
  return chosen.slice(0, input.max_reasons ?? 3);
}
