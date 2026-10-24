import type {
  GameDay,
  GameDetail,
  GameState,
  GameSummary,
  Sport,
  SportsDay,
} from "@voita_kone/shared_types";
import { SPORT_IDS } from "@voita_kone/scoring";
import { AppError } from "../../common/app_error";
import {
  add_local_days,
  helsinki_day_range,
  is_local_date,
  local_days_between,
  to_helsinki_date,
} from "../../common/helsinki_date";
import type { Clock } from "../../common/clock";
import { order_game_day, to_game_detail, to_game_summary } from "./games_mapper";
import type { GameRow, GamesRepository } from "./games_repository";

export const MAX_RANGE_DAYS = 31;
const DEFAULT_RANGE_DAYS = 6;
const STATUS_BY_STATE: Record<GameState, string> = {
  upcoming: "scheduled",
  live: "live",
  final: "final",
};

export interface GameListQuery {
  from?: string;
  to?: string;
  team_id?: string;
  state?: GameState;
  sport: Sport;
}

/** Games and live games per sport, every sport listed (0 when it has none). */
export function count_by_sport(
  games: readonly Pick<GameRow, "sport" | "status">[],
): SportsDay["sports"] {
  return SPORT_IDS.map((sport) => {
    const mine = games.filter((game) => game.sport === sport);
    return {
      sport,
      game_count: mine.length,
      live_count: mine.filter((game) => game.status === "live").length,
    };
  });
}

export function game_not_found(game_id: string): AppError {
  return new AppError("GAME_NOT_FOUND", 404, `Game ${game_id} not found`);
}

function invalid_date(value: string): AppError {
  return new AppError("INVALID_DATE", 400, `"${value}" is not a date. Use YYYY-MM-DD or "today".`);
}

export class GamesService {
  constructor(
    private readonly games_repository: GamesRepository,
    private readonly featured_team_external_id: string,
    private readonly clock: Clock,
  ) {}

  /** "today" or YYYY-MM-DD to a Helsinki calendar day. */
  resolve_date(value: string): string {
    if (value === "today") {
      return to_helsinki_date(this.clock());
    }
    if (!is_local_date(value)) {
      throw invalid_date(value);
    }
    return value;
  }

  /** The hub: one sport's games of a Helsinki day. */
  async get_game_day(date_value: string, sport: Sport): Promise<GameDay> {
    const date = this.resolve_date(date_value);
    const games = await this.games_repository.list_games({ ...helsinki_day_range(date), sport });
    return {
      date,
      games: order_game_day(games.map((game) => this.to_summary(game))),
      demo_replay: false,
    };
  }

  /** The sport tabs: every sport (config order) with its game count for the day. */
  async get_sports_day(date_value: string): Promise<SportsDay> {
    const date = this.resolve_date(date_value);
    const games = await this.games_repository.list_games(helsinki_day_range(date));
    return { date, sports: count_by_sport(games) };
  }

  /** Games from `from` to `to` (Helsinki days, inclusive), at most 31 days apart. */
  async list_games(query: GameListQuery): Promise<GameSummary[]> {
    const from = this.resolve_date(query.from ?? "today");
    const to = query.to ? this.resolve_date(query.to) : add_local_days(from, DEFAULT_RANGE_DAYS);
    const days = local_days_between(from, to);
    if (days < 0) {
      throw new AppError("INVALID_DATE", 400, `"to" (${to}) is before "from" (${from})`);
    }
    if (days > MAX_RANGE_DAYS) {
      throw new AppError(
        "RANGE_TOO_LARGE",
        400,
        `The range can be at most ${String(MAX_RANGE_DAYS)} days (got ${String(days)})`,
      );
    }

    const games = await this.games_repository.list_games({
      start: helsinki_day_range(from).start,
      end: helsinki_day_range(to).end,
      team_id: query.team_id,
      statuses: query.state ? [STATUS_BY_STATE[query.state]] : undefined,
      sport: query.sport,
    });
    return games.map((game) => this.to_summary(game));
  }

  async get_game_detail(game_id: string): Promise<GameDetail> {
    const game = await this.games_repository.find_game(game_id);
    if (!game) {
      throw game_not_found(game_id);
    }
    const events = await this.games_repository.list_events(game_id);
    return to_game_detail(this.to_summary(game), events, game.top_scorer);
  }

  private to_summary(game: GameRow): GameSummary {
    return to_game_summary(game, this.featured_team_external_id);
  }
}
