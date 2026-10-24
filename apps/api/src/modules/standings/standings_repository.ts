import { jsonObjectFrom } from "kysely/helpers/postgres";
import type { Database } from "../../db/kysely";
import type { TeamRow } from "../teams/teams_mapper";

export interface SnapshotRef {
  season: string;
  taken_at: Date;
}

export interface StandingsRowRecord {
  rank: number;
  games_played: number;
  points: number;
  goals_for: number;
  goals_against: number;
  team: TeamRow;
}

export interface FinishedGameRecord {
  home_team_id: string;
  away_team_id: string;
  home_goals: number;
  away_goals: number;
  ended_in: string;
  start_time: Date;
}

export interface StandingsRepository {
  /** The newest snapshot of a season, or of the latest season when none is given. */
  find_latest_snapshot(season?: string): Promise<SnapshotRef | undefined>;
  list_rows(snapshot: SnapshotRef): Promise<StandingsRowRecord[]>;
  /** Real (Liiga) finished games of a season, newest first. */
  list_finished_games(season: string): Promise<FinishedGameRecord[]>;
}

export class KyselyStandingsRepository implements StandingsRepository {
  constructor(private readonly db: Database) {}

  async find_latest_snapshot(season?: string): Promise<SnapshotRef | undefined> {
    let query = this.db
      .selectFrom("standings_snapshots")
      .select(["season", "taken_at"])
      .orderBy("taken_at", "desc")
      .limit(1);
    if (season) {
      query = query.where("season", "=", season);
    }
    return query.executeTakeFirst();
  }

  list_rows(snapshot: SnapshotRef): Promise<StandingsRowRecord[]> {
    return this.db
      .selectFrom("standings_snapshots")
      .select((eb) => [
        "standings_snapshots.rank",
        "standings_snapshots.games_played",
        "standings_snapshots.points",
        "standings_snapshots.goals_for",
        "standings_snapshots.goals_against",
        jsonObjectFrom(
          eb
            .selectFrom("teams")
            .select([
              "teams.id",
              "teams.external_id",
              "teams.name",
              "teams.short_name",
              "teams.city",
              "teams.logo_url",
              "teams.data_source",
            ])
            .whereRef("teams.id", "=", "standings_snapshots.team_id"),
        )
          .$notNull()
          .as("team"),
      ])
      .where("standings_snapshots.season", "=", snapshot.season)
      .where("standings_snapshots.taken_at", "=", snapshot.taken_at)
      .orderBy("standings_snapshots.rank")
      .execute();
  }

  async list_finished_games(season: string): Promise<FinishedGameRecord[]> {
    const rows = await this.db
      .selectFrom("games")
      .select([
        "home_team_id",
        "away_team_id",
        "home_goals",
        "away_goals",
        "ended_in",
        "start_time",
      ])
      .where("season", "=", season)
      .where("status", "=", "final")
      .where("data_source", "=", "liiga_api")
      .orderBy("start_time", "desc")
      .execute();
    // A final game always has a result (DB check constraint).
    return rows.flatMap((row) =>
      row.home_goals !== null && row.away_goals !== null && row.ended_in !== null
        ? [
            {
              ...row,
              home_goals: row.home_goals,
              away_goals: row.away_goals,
              ended_in: row.ended_in,
            },
          ]
        : [],
    );
  }
}
