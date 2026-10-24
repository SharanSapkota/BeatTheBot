import type { Transaction } from "kysely";
import type { DB, JsonObject } from "../db/database_types";
import type { Database } from "../db/kysely";
import type {
  LiigaSnapshot,
  SyncGame,
  SyncGameEvent,
  SyncPlayer,
  SyncTeam,
} from "../integrations/liiga_client/liiga_mapper";

export interface SyncCounts {
  team_count: number;
  player_count: number;
  game_count: number;
  event_count: number;
  standing_count: number;
}

export interface SyncGamesRepository {
  /** Upserts one Liiga snapshot in a single transaction. Never touches demo rows. */
  save_snapshot(snapshot: LiigaSnapshot): Promise<SyncCounts>;
}

export interface DueGame {
  external_id: string;
  season: string;
}

export interface LiveSyncRepository {
  /** Liiga games that should be live: started after `earliest_start`, by `now`, not final. */
  find_due_games(now: Date, earliest_start: Date): Promise<DueGame[]>;
  /** Updates these games (score, period, clock, status) and replaces their events. */
  save_games(games: readonly SyncGame[], events: readonly SyncGameEvent[]): Promise<number>;
}

type IdMap = ReadonlyMap<string, string>;
type ExternalTable = "teams" | "players" | "games";

const INSERT_CHUNK_SIZE = 1000;
const LIIGA_API = "liiga_api";

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

// The mapper keeps the original Liiga event; a JSON round trip makes it a plain JSON object.
function to_json_object(value: Record<string, unknown>): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

/** Our uuid per external_id, for Liiga rows only. */
async function load_ids(
  trx: Transaction<DB>,
  table: ExternalTable,
  external_ids: readonly string[],
): Promise<IdMap> {
  if (external_ids.length === 0) {
    return new Map();
  }
  const rows = await trx
    .selectFrom(table)
    .select(["id", "external_id"])
    .where("external_id", "in", external_ids)
    .where("data_source", "=", LIIGA_API)
    .execute();
  return new Map(rows.map((row) => [row.external_id, row.id]));
}

async function upsert_teams(trx: Transaction<DB>, teams: readonly SyncTeam[]): Promise<IdMap> {
  if (teams.length > 0) {
    await trx
      .insertInto("teams")
      .values(teams.map((team) => ({ ...team, data_source: LIIGA_API })))
      .onConflict((conflict) =>
        conflict
          .column("external_id")
          .doUpdateSet((eb) => ({
            name: eb.ref("excluded.name"),
            short_name: eb.ref("excluded.short_name"),
            city: eb.ref("excluded.city"),
            logo_url: eb.ref("excluded.logo_url"),
          }))
          .where("teams.data_source", "=", LIIGA_API),
      )
      .execute();
  }
  return load_ids(
    trx,
    "teams",
    teams.map((team) => team.external_id),
  );
}

async function upsert_players(
  trx: Transaction<DB>,
  players: readonly SyncPlayer[],
  team_ids: IdMap,
): Promise<IdMap> {
  const rows = players.flatMap(({ team_external_id, ...player }) => {
    const team_id = team_ids.get(team_external_id);
    return team_id ? [{ ...player, team_id, data_source: LIIGA_API }] : [];
  });
  for (const rows_chunk of chunk(rows, INSERT_CHUNK_SIZE)) {
    await trx
      .insertInto("players")
      .values(rows_chunk)
      .onConflict((conflict) =>
        conflict
          .column("external_id")
          .doUpdateSet((eb) => ({
            team_id: eb.ref("excluded.team_id"),
            first_name: eb.ref("excluded.first_name"),
            last_name: eb.ref("excluded.last_name"),
            jersey_number: eb.ref("excluded.jersey_number"),
            position: eb.ref("excluded.position"),
            birth_year: eb.ref("excluded.birth_year"),
          }))
          .where("players.data_source", "=", LIIGA_API),
      )
      .execute();
  }
  return load_ids(
    trx,
    "players",
    rows.map((row) => row.external_id),
  );
}

async function upsert_games(
  trx: Transaction<DB>,
  games: readonly SyncGame[],
  team_ids: IdMap,
): Promise<IdMap> {
  const rows = games.flatMap(({ home_team_external_id, away_team_external_id, ...game }) => {
    const home_team_id = team_ids.get(home_team_external_id);
    const away_team_id = team_ids.get(away_team_external_id);
    return home_team_id && away_team_id
      ? [{ ...game, home_team_id, away_team_id, data_source: LIIGA_API }]
      : [];
  });
  for (const rows_chunk of chunk(rows, INSERT_CHUNK_SIZE)) {
    await trx
      .insertInto("games")
      .values(rows_chunk)
      .onConflict((conflict) =>
        conflict
          .column("external_id")
          .doUpdateSet((eb) => ({
            season: eb.ref("excluded.season"),
            home_team_id: eb.ref("excluded.home_team_id"),
            away_team_id: eb.ref("excluded.away_team_id"),
            start_time: eb.ref("excluded.start_time"),
            status: eb.ref("excluded.status"),
            home_goals: eb.ref("excluded.home_goals"),
            away_goals: eb.ref("excluded.away_goals"),
            ended_in: eb.ref("excluded.ended_in"),
            period: eb.ref("excluded.period"),
            game_clock_seconds: eb.ref("excluded.game_clock_seconds"),
          }))
          .where("games.data_source", "=", LIIGA_API),
      )
      .execute();
  }
  return load_ids(
    trx,
    "games",
    rows.map((row) => row.external_id),
  );
}

/** Liiga events have no stable id across games, so each synced game's events are replaced. */
async function replace_events(
  trx: Transaction<DB>,
  events: readonly SyncGameEvent[],
  ids: { team_ids: IdMap; player_ids: IdMap; game_ids: IdMap },
): Promise<number> {
  const game_ids = [...ids.game_ids.values()];
  if (game_ids.length > 0) {
    await trx
      .deleteFrom("game_events")
      .where("game_id", "in", game_ids)
      .where("data_source", "=", LIIGA_API)
      .execute();
  }

  const rows = events.flatMap((event) => {
    const game_id = ids.game_ids.get(event.game_external_id);
    if (!game_id) {
      return [];
    }
    // Players missing from /players stay unknown (null) instead of failing the sync.
    const player_id = event.player_external_id
      ? (ids.player_ids.get(event.player_external_id) ?? null)
      : null;
    const assist_player_ids = event.assist_player_external_ids.flatMap((external_id) => {
      const assist_id = ids.player_ids.get(external_id);
      return assist_id ? [assist_id] : [];
    });
    return [
      {
        game_id,
        event_type: event.event_type,
        period: event.period,
        game_time_seconds: event.game_time_seconds,
        team_id: ids.team_ids.get(event.team_external_id) ?? null,
        player_id,
        assist_player_ids,
        raw: to_json_object(event.raw),
        data_source: LIIGA_API,
      },
    ];
  });
  for (const rows_chunk of chunk(rows, INSERT_CHUNK_SIZE)) {
    await trx.insertInto("game_events").values(rows_chunk).execute();
  }
  return rows.length;
}

async function save_standings(
  trx: Transaction<DB>,
  snapshot: LiigaSnapshot,
  team_ids: IdMap,
): Promise<number> {
  const rows = snapshot.standings.rows.flatMap(({ team_external_id, ...row }) => {
    const team_id = team_ids.get(team_external_id);
    return team_id
      ? [
          {
            ...row,
            team_id,
            season: snapshot.season,
            taken_at: snapshot.standings.taken_at,
            data_source: LIIGA_API,
          },
        ]
      : [];
  });
  if (rows.length > 0) {
    await trx
      .insertInto("standings_snapshots")
      .values(rows)
      .onConflict((conflict) =>
        conflict.columns(["season", "taken_at", "team_id"]).doUpdateSet((eb) => ({
          games_played: eb.ref("excluded.games_played"),
          points: eb.ref("excluded.points"),
          goals_for: eb.ref("excluded.goals_for"),
          goals_against: eb.ref("excluded.goals_against"),
          rank: eb.ref("excluded.rank"),
        })),
      )
      .execute();
  }
  return rows.length;
}

export class KyselySyncGamesRepository implements SyncGamesRepository, LiveSyncRepository {
  constructor(private readonly db: Database) {}

  find_due_games(now: Date, earliest_start: Date): Promise<DueGame[]> {
    return this.db
      .selectFrom("games")
      .select(["external_id", "season"])
      .where("data_source", "=", LIIGA_API)
      .where("status", "<>", "final")
      .where("start_time", "<=", now)
      .where("start_time", ">=", earliest_start)
      .orderBy("start_time")
      .execute();
  }

  save_games(games: readonly SyncGame[], events: readonly SyncGameEvent[]): Promise<number> {
    return this.db.transaction().execute(async (trx) => {
      const team_ids = await load_ids(
        trx,
        "teams",
        games.flatMap((game) => [game.home_team_external_id, game.away_team_external_id]),
      );
      const player_ids = await load_ids(
        trx,
        "players",
        events.flatMap((event) => [
          ...(event.player_external_id ? [event.player_external_id] : []),
          ...event.assist_player_external_ids,
        ]),
      );
      const game_ids = await upsert_games(trx, games, team_ids);
      await replace_events(trx, events, { team_ids, player_ids, game_ids });
      return game_ids.size;
    });
  }

  save_snapshot(snapshot: LiigaSnapshot): Promise<SyncCounts> {
    return this.db.transaction().execute(async (trx) => {
      const team_ids = await upsert_teams(trx, snapshot.teams);
      const player_ids = await upsert_players(trx, snapshot.players, team_ids);
      const game_ids = await upsert_games(trx, snapshot.games, team_ids);
      const event_count = await replace_events(trx, snapshot.events, {
        team_ids,
        player_ids,
        game_ids,
      });
      const standing_count = await save_standings(trx, snapshot, team_ids);
      return {
        team_count: team_ids.size,
        player_count: player_ids.size,
        game_count: game_ids.size,
        event_count,
        standing_count,
      };
    });
  }
}
