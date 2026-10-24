import { describe, expect, it } from "vitest";
import { FixtureLiigaClient } from "../integrations/liiga_client/fixture_liiga_client";
import type { LiigaSnapshot } from "../integrations/liiga_client/liiga_mapper";
import { SyncGamesJob } from "./sync_games";
import type { SyncCounts, SyncGamesRepository } from "./sync_games_repository";

class FakeSyncGamesRepository implements SyncGamesRepository {
  saved: LiigaSnapshot[] = [];

  save_snapshot(snapshot: LiigaSnapshot): Promise<SyncCounts> {
    this.saved.push(snapshot);
    return Promise.resolve({
      team_count: snapshot.teams.length,
      player_count: snapshot.players.length,
      game_count: snapshot.games.length,
      event_count: snapshot.events.length,
      standing_count: snapshot.standings.rows.length,
    });
  }
}

const NOW = new Date("2026-10-24T09:00:00Z");

describe("SyncGamesJob", () => {
  it("reads the current season from Liiga and saves the mapped snapshot", async () => {
    const repository = new FakeSyncGamesRepository();
    const job = new SyncGamesJob(new FixtureLiigaClient(), repository, () => NOW);

    const summary = await job.run();

    expect(repository.saved).toHaveLength(1);
    expect(summary).toEqual({
      season: "2026-27",
      skipped_game_count: 0,
      team_count: 17,
      player_count: 63,
      game_count: 9,
      event_count: repository.saved[0]?.events.length,
      standing_count: 17,
    });
    expect(summary.event_count).toBeGreaterThan(0);
  });

  it("does not save anything when Liiga fails", async () => {
    const repository = new FakeSyncGamesRepository();
    const client = new FixtureLiigaClient("/does/not/exist");
    const job = new SyncGamesJob(client, repository, () => NOW);

    await expect(job.run()).rejects.toThrow();
    expect(repository.saved).toHaveLength(0);
  });
});
