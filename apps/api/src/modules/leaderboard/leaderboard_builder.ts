import type {
  Leaderboard,
  LeaderboardPeriod,
  LeaderboardRow,
  SportFilter,
} from "@voita_kone/shared_types";
import { winner_team_id, type GameResult } from "@voita_kone/scoring";
import { to_helsinki_date } from "../../common/helsinki_date";
import { week_start } from "./leaderboard_week";

// Fans vs fans: the leaderboard from the season's finished games and the users' scored picks
// and answers. Pure, so ranks and accuracy are tested without a database.

/** Rows shown before the "you" row is added. */
export const TOP_ROW_COUNT = 10;

export interface LeaderboardGame {
  id: string;
  start_time: Date;
  result: GameResult;
}

export interface LeaderboardPick {
  user_id: string;
  display_name: string;
  game_id: string;
  /** Null = a draw pick (football). */
  winner_team_id: string | null;
  points_awarded: number;
}

/** A user's points from live picks, the quiz and the vote in one game (no winner pick). */
export interface LeaderboardAnswerPoints {
  user_id: string;
  display_name: string;
  game_id: string;
  points_awarded: number;
}

export interface LeaderboardInput {
  period: LeaderboardPeriod;
  /** Which sports the games are from (the caller filters them). */
  sport: SportFilter;
  now: Date;
  /** Finished games of the season. */
  games: readonly LeaderboardGame[];
  /** Scored picks on those games. */
  picks: readonly LeaderboardPick[];
  /** Scored answers on those games (count for points, not for winner accuracy). */
  answers?: readonly LeaderboardAnswerPoints[];
  me_user_id: string | null;
  prize: Leaderboard["prize"];
}

interface Entry {
  id: string;
  display_name: string;
  points: number;
}

interface RankedEntry extends Entry {
  rank: number;
}

/** Most points first; equal points share a rank (1, 2, 2, 4), then by name. */
export function rank_entries(entries: readonly Entry[]): RankedEntry[] {
  const sorted = [...entries].sort(
    (first, second) =>
      second.points - first.points || first.display_name.localeCompare(second.display_name, "fi"),
  );
  let previous: RankedEntry | undefined;
  return sorted.map((entry, index) => {
    const rank = previous?.points === entry.points ? previous.rank : index + 1;
    previous = { ...entry, rank };
    return previous;
  });
}

/** null when there is nothing to measure (no picks), not 0%. */
function share(correct: number, total: number): number | null {
  return total === 0 ? null : correct / total;
}

/** The winner (or, in football, the draw) was right. */
function is_right(game: LeaderboardGame, picked_team_id: string | null): boolean {
  return picked_team_id === winner_team_id(game.result);
}

function build_entries(
  picks: readonly LeaderboardPick[],
  answers: readonly LeaderboardAnswerPoints[],
): Entry[] {
  const by_user = new Map<string, Entry>();
  for (const pick of [...picks, ...answers]) {
    const entry = by_user.get(pick.user_id) ?? {
      id: pick.user_id,
      display_name: pick.display_name,
      points: 0,
    };
    entry.points += pick.points_awarded;
    by_user.set(pick.user_id, entry);
  }
  return [...by_user.values()];
}

function accuracy_of(
  games: readonly LeaderboardGame[],
  picks: readonly LeaderboardPick[],
  me_user_id: string | null,
): { fans: number | null; you: number | null } {
  const game_by_id = new Map(games.map((game) => [game.id, game]));
  const right = (pick: LeaderboardPick) => {
    const game = game_by_id.get(pick.game_id);
    return game ? is_right(game, pick.winner_team_id) : false;
  };
  const my_picks = picks.filter((pick) => pick.user_id === me_user_id);
  return {
    fans: share(picks.filter(right).length, picks.length),
    you: share(my_picks.filter(right).length, my_picks.length),
  };
}

function to_row(
  entry: RankedEntry,
  me_user_id: string | null,
  movement: number | null,
): LeaderboardRow {
  const is_me = entry.id === me_user_id;
  return {
    rank: entry.rank,
    kind: is_me ? "you" : "user",
    display_name: entry.display_name,
    points: entry.points,
    movement: is_me ? movement : null,
  };
}

/** Places the user gained since the last game day of the period (null without an earlier rank). */
function movement_of(
  games: readonly LeaderboardGame[],
  picks: readonly LeaderboardPick[],
  answers: readonly LeaderboardAnswerPoints[],
  me_user_id: string | null,
  my_rank: number | undefined,
): number | null {
  if (me_user_id === null || my_rank === undefined || games.length === 0) {
    return null;
  }
  const last_day = games
    .map((game) => to_helsinki_date(game.start_time))
    .sort()
    .at(-1);
  const earlier_games = games.filter((game) => to_helsinki_date(game.start_time) !== last_day);
  const earlier_ids = new Set(earlier_games.map((game) => game.id));
  const earlier_picks = picks.filter((pick) => earlier_ids.has(pick.game_id));
  const earlier_answers = answers.filter((answer) => earlier_ids.has(answer.game_id));
  const earlier_rank = rank_entries(build_entries(earlier_picks, earlier_answers)).find(
    (entry) => entry.id === me_user_id,
  )?.rank;
  return earlier_rank === undefined ? null : earlier_rank - my_rank;
}

export function build_leaderboard(input: LeaderboardInput): Leaderboard {
  const from = input.period === "week" ? week_start(input.now) : null;
  const games = input.games.filter((game) => from === null || game.start_time >= from);
  const game_ids = new Set(games.map((game) => game.id));
  const picks = input.picks.filter((pick) => game_ids.has(pick.game_id));
  const answers = (input.answers ?? []).filter((answer) => game_ids.has(answer.game_id));

  const ranked = rank_entries(build_entries(picks, answers));
  const mine = ranked.find((entry) => entry.id === input.me_user_id);
  const movement = movement_of(games, picks, answers, input.me_user_id, mine?.rank);
  const shown = ranked.filter((entry, index) => index < TOP_ROW_COUNT || entry === mine);
  const accuracy = accuracy_of(games, picks, input.me_user_id);

  return {
    period: input.period,
    sport: input.sport,
    summary: {
      you_accuracy: accuracy.you,
      fans_accuracy: accuracy.fans,
      games_count: games.length,
    },
    prize: input.prize,
    rows: shown.map((entry) => to_row(entry, input.me_user_id, movement)),
  };
}
