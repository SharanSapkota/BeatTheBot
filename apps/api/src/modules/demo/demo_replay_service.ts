import type {
  GameDay,
  GameDetail,
  GameSummary,
  ReplayMoment,
  Sport,
  SportsDay,
} from "@voita_kone/shared_types";
import { SPORT_IDS } from "@voita_kone/scoring";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import { helsinki_day_range, to_helsinki_date } from "../../common/helsinki_date";
import { order_game_day } from "../games/games_mapper";
import type { GameRow, GamesRepository } from "../games/games_repository";
import { count_by_sport, game_not_found, type GamesService } from "../games/games_service";
import { to_sport } from "../teams/teams_mapper";
import { choose_live_cut, replay_game } from "./replay_game";

const MINUTE_MS = 60 * 1000;
/** Where the replayed game's puck drop is placed relative to now, per moment. */
const START_OFFSET_MINUTES: Record<ReplayMoment, number> = {
  before: 120,
  live: -75,
  final: -180,
};

interface ReplayContext {
  /** Helsinki day of the replayed real games. */
  day: string;
  /** Added to every start time, so the replay happens "today". */
  shift_ms: number;
  live_cut_seconds: number;
}

function to_summary(detail: GameDetail): GameSummary {
  const { events: _events, demo_replay: _demo_replay, ...summary } = detail;
  return summary;
}

function shift_start(detail: GameDetail, shift_ms: number): GameDetail {
  const start_time = new Date(new Date(detail.start_time).getTime() + shift_ms).toISOString();
  return { ...detail, start_time };
}

export class DemoReplayService {
  constructor(
    private readonly games_repository: GamesRepository,
    private readonly games_service: GamesService,
    private readonly featured_team_external_id: string,
    private readonly clock: Clock,
  ) {}

  /**
   * The real day of the sport's source game, replayed at `moment` and shifted to today: the
   * finished games of that sport on that day. Football and basketball replay sample games; a
   * sport without one has an empty day.
   */
  async get_game_day(moment: ReplayMoment, sport: Sport = "hockey"): Promise<GameDay> {
    const date = to_helsinki_date(this.clock());
    const source = await this.find_source_game(sport);
    if (!source) {
      return { date, games: [], demo_replay: true };
    }
    const context = await this.build_context(source, moment);
    const finished = await this.list_replay_day(context.day, sport);
    const details = await Promise.all(
      finished.map((game) => this.replay(game.id, moment, context)),
    );
    return { date, games: order_game_day(details.map(to_summary)), demo_replay: true };
  }

  /** The sport tabs in demo mode: each sport's replay day. */
  async get_sports_day(): Promise<SportsDay> {
    const days = await Promise.all(
      SPORT_IDS.map(async (sport) => {
        const source = await this.find_source_game(sport);
        return source ? this.list_replay_day(to_helsinki_date(source.start_time), sport) : [];
      }),
    );
    // Every replayed game is shown as live, upcoming or final at the same moment; none is live
    // on the real clock.
    const games = days.flat().map((game) => ({ sport: game.sport, status: "final" }));
    return { date: to_helsinki_date(this.clock()), sports: count_by_sport(games) };
  }

  /** One finished game replayed at `moment`; games of the replay day share its shift. */
  async get_game_detail(game_id: string, moment: ReplayMoment): Promise<GameDetail> {
    const game = await this.games_repository.find_game(game_id);
    if (game?.status !== "final") {
      throw game_not_found(game_id);
    }
    const source = await this.find_source_game(to_sport(game.sport));
    const same_day =
      source !== undefined &&
      to_helsinki_date(game.start_time) === to_helsinki_date(source.start_time);
    const context = await this.build_context(same_day ? source : game, moment);
    return this.replay(game_id, moment, context);
  }

  private async list_replay_day(day: string, sport: Sport): Promise<GameRow[]> {
    const games = await this.games_repository.list_games({ ...helsinki_day_range(day), sport });
    return games.filter((game) => game.status === "final");
  }

  /**
   * Hockey: the latest finished featured-team Liiga game with goals; else the featured demo
   * game; else any finished demo game. Other sports: their latest finished sample game.
   */
  private async find_source_game(sport: Sport): Promise<GameRow | undefined> {
    if (sport !== "hockey") {
      return this.games_repository.find_latest_demo_final(sport);
    }
    const source =
      (await this.games_repository.find_latest_final_game(
        this.featured_team_external_id,
        "liiga_api",
      )) ??
      (await this.games_repository.find_latest_final_game(
        this.featured_team_external_id,
        "demo",
      )) ??
      (await this.games_repository.find_latest_demo_final("hockey"));
    if (!source) {
      throw new AppError("DEMO_REPLAY_UNAVAILABLE", 404, "No finished game to replay");
    }
    return source;
  }

  private async build_context(source: GameRow, moment: ReplayMoment): Promise<ReplayContext> {
    const target_start = this.clock().getTime() + START_OFFSET_MINUTES[moment] * MINUTE_MS;
    const source_detail = await this.games_service.get_game_detail(source.id);
    return {
      day: to_helsinki_date(source.start_time),
      shift_ms: target_start - source.start_time.getTime(),
      live_cut_seconds: choose_live_cut(source_detail),
    };
  }

  private async replay(
    game_id: string,
    moment: ReplayMoment,
    context: ReplayContext,
  ): Promise<GameDetail> {
    const detail = await this.games_service.get_game_detail(game_id);
    return shift_start(replay_game(detail, moment, context.live_cut_seconds), context.shift_ms);
  }
}
