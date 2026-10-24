import { pino } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FixtureLiigaClient } from "../integrations/liiga_client/fixture_liiga_client";
import type { SyncGame, SyncGameEvent } from "../integrations/liiga_client/liiga_mapper";
import type { LiigaGame } from "../integrations/liiga_client/liiga_schemas";
import { LiveSyncJob, LiveSyncPoller } from "./live_sync";
import type { DueGame, LiveSyncRepository } from "./sync_games_repository";

const NOW = new Date("2026-10-24T15:00:00Z");
const logger = pino({ level: "silent" });

class FakeLiveSyncRepository implements LiveSyncRepository {
  saved: { games: readonly SyncGame[]; events: readonly SyncGameEvent[] }[] = [];

  constructor(private readonly due: DueGame[]) {}

  find_due_games(): Promise<DueGame[]> {
    return Promise.resolve(this.due);
  }

  save_games(games: readonly SyncGame[], events: readonly SyncGameEvent[]): Promise<number> {
    this.saved.push({ games, events });
    return Promise.resolve(games.length);
  }
}

/** The real Kärpät - KalPa fixture game, now live at 1-0 in the 2nd period. */
class LiveFixtureClient extends FixtureLiigaClient {
  calls: number[] = [];
  fail_ids = new Set<number>();

  override async get_game(season: number, game_id: number): Promise<LiigaGame> {
    this.calls.push(game_id);
    if (this.fail_ids.has(game_id)) {
      throw new Error("Liiga is down");
    }
    const game = await super.get_game(season, game_id);
    return {
      ...game,
      started: true,
      currentPeriod: 2,
      gameTime: 1500,
      homeTeam: {
        ...game.homeTeam,
        goals: 1,
        goalEvents: [{ eventId: 1, scorerPlayerId: 31803661, period: 1, gameTime: 600 }],
      },
    };
  }
}

describe("LiveSyncJob", () => {
  it("does not call Liiga when no game should be live", async () => {
    const client = new LiveFixtureClient();
    const repository = new FakeLiveSyncRepository([]);

    const result = await new LiveSyncJob(client, repository, logger, () => NOW).run_once();

    expect(result).toEqual({ due_count: 0, updated_count: 0, failed_count: 0 });
    expect(client.calls).toEqual([]);
    expect(repository.saved).toEqual([]);
  });

  it("saves score, period, clock, status and events of due games", async () => {
    const client = new LiveFixtureClient();
    const repository = new FakeLiveSyncRepository([{ external_id: "2701412", season: "2026-27" }]);

    const result = await new LiveSyncJob(client, repository, logger, () => NOW).run_once();

    expect(result).toEqual({ due_count: 1, updated_count: 1, failed_count: 0 });
    expect(client.calls).toEqual([2701412]);
    expect(repository.saved[0]?.games[0]).toMatchObject({
      external_id: "2701412",
      status: "live",
      home_goals: 1,
      away_goals: 0,
      period: 2,
      game_clock_seconds: 1500,
    });
    expect(repository.saved[0]?.events).toHaveLength(1);
  });

  it("keeps going when one game fails", async () => {
    const client = new LiveFixtureClient();
    client.fail_ids.add(2701412);
    const repository = new FakeLiveSyncRepository([
      { external_id: "2701412", season: "2026-27" },
      { external_id: "2701421", season: "2026-27" },
    ]);

    const result = await new LiveSyncJob(client, repository, logger, () => NOW).run_once();

    expect(result).toEqual({ due_count: 2, updated_count: 1, failed_count: 1 });
    expect(repository.saved[0]?.games.map((game) => game.external_id)).toEqual(["2701421"]);
  });
});

describe("LiveSyncPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs every interval and survives a failing run", async () => {
    const run_once = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("database is down"))
      .mockResolvedValue({ due_count: 0 });
    const poller = new LiveSyncPoller({ run_once }, 30_000, logger);

    poller.start();
    expect(run_once).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run_once).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run_once).toHaveBeenCalledTimes(2);

    await poller.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run_once).toHaveBeenCalledTimes(2);
  });
});
