import type { LiigaClient } from "../integrations/liiga_client/liiga_client";
import { map_liiga_responses } from "../integrations/liiga_client/liiga_mapper";
import type { SyncCounts, SyncGamesRepository } from "./sync_games_repository";

export interface SyncGamesSummary extends SyncCounts {
  season: string;
  skipped_game_count: number;
}

export function describe_sync_summary(summary: SyncGamesSummary): string {
  const skipped =
    summary.skipped_game_count > 0 ? ` (${String(summary.skipped_game_count)} games skipped)` : "";
  return (
    `Liiga ${summary.season}: ${String(summary.team_count)} teams, ` +
    `${String(summary.player_count)} players, ${String(summary.game_count)} games, ` +
    `${String(summary.event_count)} events, ${String(summary.standing_count)} standings rows${skipped}`
  );
}

/** Copies the current Liiga season (teams, players, games, events, standings) into our DB. */
export class SyncGamesJob {
  constructor(
    private readonly liiga_client: LiigaClient,
    private readonly repository: SyncGamesRepository,
    private readonly now: () => Date,
  ) {}

  async run(): Promise<SyncGamesSummary> {
    const { season } = await this.liiga_client.get_tournament();
    const [teams, players, games, standings] = await Promise.all([
      this.liiga_client.get_teams(season),
      this.liiga_client.get_players(season),
      this.liiga_client.get_games(season),
      this.liiga_client.get_standings(season),
    ]);

    const snapshot = map_liiga_responses({ season, teams, players, games, standings }, this.now());
    const counts = await this.repository.save_snapshot(snapshot);
    return {
      season: snapshot.season,
      skipped_game_count: snapshot.skipped_game_count,
      ...counts,
    };
  }
}
