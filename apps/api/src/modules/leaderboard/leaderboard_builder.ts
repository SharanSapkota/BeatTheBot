import type { Leaderboard, LeaderboardPeriod, LeaderboardRow } from "@voita_kone/shared_types";
import {
  score_ai_pick,
  winner_team_id,
  type GameResult,
  type PreGamePick,
} from "@voita_kone/scoring";
import { to_helsinki_date } from "../../common/helsinki_date";
import { previous_week_mondays, week_monday, week_start } from "./leaderboard_week";

// The leaderboard from the season's finished games, the AI's picks and the users' scored picks.
// Pure, so ranks, accuracy and the weekly comparison are tested without a database.

/** Rows shown before the AI and "you" rows are added. */
export const TOP_ROW_COUNT = 10;
/** "Fans beat the AI in N of the last 5 weeks". */
export const COMPARED_WEEK_COUNT = 5;
export const AI_DISPLAY_NAME = "Kaleva AI";

export interface LeaderboardGame {
  id: string;
  start_time: Date;
  result: GameResult;
  ai_pick: PreGamePick | null;
}

export interface LeaderboardPick {
  user_id: string;
  display_name: string;
  game_id: string;
  winner_team_id: string;
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
  kind: "user" | "ai";
  id: string;
  display_name: string;
  points: number;
}

interface RankedEntry extends Entry {
  rank: number;
}

const AI_ENTRY_ID = "ai";

/** Most points first; equal points share a rank (1, 2, 2, 4). Users before the AI on a tie. */
export function rank_entries(entries: readonly Entry[]): RankedEntry[] {
  const sorted = [...entries].sort(
    (first, second) =>
      second.points - first.points ||
      Number(first.kind === "ai") - Number(second.kind === "ai") ||
      first.display_name.localeCompare(second.display_name, "fi"),
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

function is_right(game: LeaderboardGame, picked_team_id: string): boolean {
  return picked_team_id === winner_team_id(game.result);
}

function build_entries(
  games: readonly LeaderboardGame[],
  picks: readonly LeaderboardPick[],
  answers: readonly LeaderboardAnswerPoints[],
) {
  const by_user = new Map<string, Entry>();
  for (const pick of [...picks, ...answers]) {
    const entry = by_user.get(pick.user_id) ?? {
      kind: "user" as const,
      id: pick.user_id,
      display_name: pick.display_name,
      points: 0,
    };
    entry.points += pick.points_awarded;
    by_user.set(pick.user_id, entry);
  }
  const ai_points = games.reduce(
    (total, game) => total + (game.ai_pick ? score_ai_pick(game.ai_pick, game.result).total : 0),
    0,
  );
  const ai: Entry = {
    kind: "ai",
    id: AI_ENTRY_ID,
    display_name: AI_DISPLAY_NAME,
    points: ai_points,
  };
  return [...by_user.values(), ai];
}

interface Accuracy {
  ai: number | null;
  fans: number | null;
  you: number | null;
  ai_game_count: number;
}

function accuracy_of(
  games: readonly LeaderboardGame[],
  picks: readonly LeaderboardPick[],
  me_user_id: string | null,
): Accuracy {
  const game_by_id = new Map(games.map((game) => [game.id, game]));
  const ai_games = games.filter((game) => game.ai_pick !== null);
  const ai_right = ai_games.filter((game) =>
    game.ai_pick ? is_right(game, game.ai_pick.winner_team_id) : false,
  ).length;
  const right = (pick: LeaderboardPick) => {
    const game = game_by_id.get(pick.game_id);
    return game ? is_right(game, pick.winner_team_id) : false;
  };
  const my_picks = picks.filter((pick) => pick.user_id === me_user_id);
  return {
    ai: share(ai_right, ai_games.length),
    fans: share(picks.filter(right).length, picks.length),
    you: share(my_picks.filter(right).length, my_picks.length),
    ai_game_count: ai_games.length,
  };
}

/** How many of the last full weeks (with both AI and fan picks) the fans beat the AI. */
function compare_weeks(input: LeaderboardInput): {
  fans_beat_ai_weeks: number;
  compared_weeks: number;
} {
  let fans_beat_ai_weeks = 0;
  let compared_weeks = 0;
  for (const monday of previous_week_mondays(input.now, COMPARED_WEEK_COUNT)) {
    const games = input.games.filter((game) => week_monday(game.start_time) === monday);
    const ids = new Set(games.map((game) => game.id));
    const picks = input.picks.filter((pick) => ids.has(pick.game_id));
    const { ai, fans } = accuracy_of(games, picks, null);
    if (ai === null || fans === null) {
      continue;
    }
    compared_weeks += 1;
    fans_beat_ai_weeks += fans > ai ? 1 : 0;
  }
  return { fans_beat_ai_weeks, compared_weeks };
}

function to_row(
  entry: RankedEntry,
  me_user_id: string | null,
  movement: number | null,
): LeaderboardRow {
  const is_me = entry.kind === "user" && entry.id === me_user_id;
  return {
    rank: entry.rank,
    kind: is_me ? "you" : entry.kind,
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
  const earlier_rank = rank_entries(
    build_entries(earlier_games, earlier_picks, earlier_answers),
  ).find((entry) => entry.id === me_user_id)?.rank;
  return earlier_rank === undefined ? null : earlier_rank - my_rank;
}

export function build_leaderboard(input: LeaderboardInput): Leaderboard {
  const from = input.period === "week" ? week_start(input.now) : null;
  const games = input.games.filter((game) => from === null || game.start_time >= from);
  const game_ids = new Set(games.map((game) => game.id));
  const picks = input.picks.filter((pick) => game_ids.has(pick.game_id));
  const answers = (input.answers ?? []).filter((answer) => game_ids.has(answer.game_id));

  const ranked = rank_entries(build_entries(games, picks, answers));
  const mine = ranked.find((entry) => entry.id === input.me_user_id);
  const movement = movement_of(games, picks, answers, input.me_user_id, mine?.rank);
  const shown = ranked.filter(
    (entry, index) => index < TOP_ROW_COUNT || entry.kind === "ai" || entry === mine,
  );
  const accuracy = accuracy_of(games, picks, input.me_user_id);

  return {
    period: input.period,
    accuracy: { you: accuracy.you, ai: accuracy.ai, fans: accuracy.fans },
    ...compare_weeks(input),
    game_count: accuracy.ai_game_count,
    prize: input.prize,
    rows: shown.map((entry) => to_row(entry, input.me_user_id, movement)),
  };
}
