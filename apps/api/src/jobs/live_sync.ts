import type { Clock } from "../common/clock";
import type { Logger } from "../common/logger";
import type { LiigaClient } from "../integrations/liiga_client/liiga_client";
import {
  map_game,
  map_game_events,
  to_liiga_season,
  type SyncGame,
  type SyncGameEvent,
} from "../integrations/liiga_client/liiga_mapper";
import type { LiveSyncRepository } from "./sync_games_repository";

/** A game that started longer ago than this is not polled any more (stale or cancelled). */
const MAX_GAME_DURATION_MS = 6 * 60 * 60 * 1000;

export interface LiveSyncResult {
  due_count: number;
  updated_count: number;
  failed_count: number;
}

/** Updates games that should be live (started, not final) from the Liiga per-game endpoint. */
export class LiveSyncJob {
  constructor(
    private readonly liiga_client: LiigaClient,
    private readonly repository: LiveSyncRepository,
    private readonly logger: Logger,
    private readonly clock: Clock,
  ) {}

  async run_once(): Promise<LiveSyncResult> {
    const now = this.clock();
    const due = await this.repository.find_due_games(
      now,
      new Date(now.getTime() - MAX_GAME_DURATION_MS),
    );
    if (due.length === 0) {
      this.logger.debug("Live sync run: no games due");
      return { due_count: 0, updated_count: 0, failed_count: 0 };
    }

    const games: SyncGame[] = [];
    const events: SyncGameEvent[] = [];
    let failed_count = 0;
    for (const { external_id, season } of due) {
      try {
        const liiga_game = await this.liiga_client.get_game(
          to_liiga_season(season),
          Number(external_id),
        );
        const game = map_game(liiga_game);
        if (game) {
          games.push(game);
          events.push(...map_game_events(liiga_game));
        }
      } catch (error) {
        failed_count += 1;
        this.logger.warn({ err: error, external_id }, "Live sync: Liiga game fetch failed");
      }
    }

    const updated_count = games.length > 0 ? await this.repository.save_games(games, events) : 0;
    const result = { due_count: due.length, updated_count, failed_count };
    this.logger.info(result, "Live sync run");
    return result;
  }
}

export interface LiveSyncRunner {
  run_once(): Promise<unknown>;
}

/** Runs the job every interval. One failing run is logged and never stops the poller. */
export class LiveSyncPoller {
  private timer: NodeJS.Timeout | undefined;
  private current_run: Promise<void> | undefined;
  private stopped = true;

  constructor(
    private readonly job: LiveSyncRunner,
    private readonly interval_ms: number,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.schedule_next();
    this.logger.info(`Live sync started (every ${String(this.interval_ms / 1000)} s)`);
  }

  /** Stops polling and waits for a run that is in progress. */
  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.current_run;
  }

  private schedule_next(): void {
    if (this.stopped) {
      return;
    }
    this.timer = setTimeout(() => {
      this.current_run = this.tick().finally(() => {
        this.current_run = undefined;
        this.schedule_next();
      });
    }, this.interval_ms);
  }

  private async tick(): Promise<void> {
    try {
      await this.job.run_once();
    } catch (error) {
      this.logger.error({ err: error }, "Live sync run failed");
    }
  }
}
