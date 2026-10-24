import type { Clock } from "../common/clock";
import type { Logger } from "../common/logger";
import { build_demo_election } from "../db/seed/demo_election";
import {
  SAMPLE_GAME_LENGTH_MS,
  finish_sample_game,
  plan_sample_games,
  sample_day_key,
} from "../db/seed/demo_refresh";
import { get_helsinki_date, helsinki_time } from "../db/seed/helsinki_time";
import type { JobTrigger } from "./job_scheduler";
import type { RefreshDemoDataRepository } from "./refresh_demo_data_repository";

/** The demo election is moved ahead once its poll closes within this many days. */
export const ELECTION_MIN_DAYS_AHEAD = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RefreshDemoDataResult {
  hockey_demo_games_removed: number;
  sample_games_finished: number;
  sample_games_added: number;
  election_moved: boolean;
}

/**
 * Keeps the demo data current (on API start and every hour; idempotent):
 * - hockey: real Liiga data only, so demo hockey games are removed;
 * - football and basketball (no data API yet, so the sample fixtures are their real data for
 *   now): passed sample games become finals with a demo result, and the coming week gets a
 *   sample game on each day that has none;
 * - the demo election's poll always closes about three weeks from now.
 * Finished games trigger the scoring jobs, so picks on them get their points.
 */
export class RefreshDemoDataJob {
  constructor(
    private readonly repository: RefreshDemoDataRepository,
    private readonly logger: Logger,
    private readonly clock: Clock,
    private readonly after_finish: readonly JobTrigger[] = [],
  ) {}

  async run(): Promise<RefreshDemoDataResult> {
    const now = this.clock();
    const hockey_demo_games_removed = await this.repository.delete_hockey_demo_games();

    let sample_games_finished = 0;
    const passed = await this.repository.list_passed_sample_games(
      new Date(now.getTime() - SAMPLE_GAME_LENGTH_MS),
    );
    for (const game of passed) {
      const final = finish_sample_game(game.external_id, game.start_time);
      if (final) {
        await this.repository.finish_sample_game(game.id, final);
        sample_games_finished += 1;
      }
    }

    const today_start = helsinki_time(get_helsinki_date(now), 0, 0);
    const starts = await this.repository.list_sample_starts(today_start);
    const days = new Set(
      starts.map((game) => `${game.sport}:${sample_day_key(get_helsinki_date(game.start_time))}`),
    );
    const sample_games_added = await this.repository.insert_sample_games(
      plan_sample_games(now, days),
      now,
    );

    const election = await this.repository.find_demo_election();
    const election_moved =
      election !== undefined &&
      election.status === "published" &&
      election.poll_closes_at.getTime() < now.getTime() + ELECTION_MIN_DAYS_AHEAD * DAY_MS;
    if (election && election_moved) {
      const { election_date, poll_opens_at, poll_closes_at } = build_demo_election(now);
      await this.repository.move_demo_election(election.id, {
        election_date,
        poll_opens_at,
        poll_closes_at,
      });
    }

    if (sample_games_finished > 0) {
      for (const trigger of this.after_finish) {
        trigger.request_run("sample games finished");
      }
    }
    const result = {
      hockey_demo_games_removed,
      sample_games_finished,
      sample_games_added,
      election_moved,
    };
    this.logger.info(result, "Demo data refreshed");
    return result;
  }
}
