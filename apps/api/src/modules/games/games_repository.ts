import { sql, type ExpressionBuilder } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import type { DB } from "../../db/database_types";
import type { Database } from "../../db/kysely";
import type { TeamRow } from "../teams/teams_mapper";

export interface GameRow {
  id: string;
  external_id: string;
  season: string;
  start_time: Date;
  status: string;
  period: number | null;
  game_clock_seconds: number | null;
  home_goals: number | null;
  away_goals: number | null;
  ended_in: string | null;
  data_source: string;
  home_team: TeamRow;
  away_team: TeamRow;
}

export interface PlayerRefRow {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}

export interface EventRow {
  id: string;
  event_type: string;
  period: number;
  game_time_seconds: number;
  team_id: string | null;
  player: PlayerRefRow | null;
  assists: PlayerRefRow[];
  penalty_minutes: number | null;
}

export interface GameFilter {
  /** start_time >= start */
  start: Date;
  /** start_time < end */
  end: Date;
  team_id?: string;
  statuses?: readonly string[];
}

export interface GamesRepository {
  /** Games in the time range, by start time. */
  list_games(filter: GameFilter): Promise<GameRow[]>;
  find_game(game_id: string): Promise<GameRow | undefined>;
  /** Stored events (goals, penalties) of one game, in game-time order. */
  list_events(game_id: string): Promise<EventRow[]>;
  /** The latest finished game of a team, from the given source, that has goal events. */
  find_latest_final_game(
    team_external_id: string,
    data_source: "liiga_api" | "demo",
  ): Promise<GameRow | undefined>;
  /** The latest finished demo game, if any. */
  find_latest_demo_final(): Promise<GameRow | undefined>;
}

const TEAM_COLUMNS = [
  "teams.id",
  "teams.external_id",
  "teams.name",
  "teams.short_name",
  "teams.city",
  "teams.logo_url",
  "teams.data_source",
] as const;

function team_object(eb: ExpressionBuilder<DB, "games">, column: "home_team_id" | "away_team_id") {
  return jsonObjectFrom(
    eb.selectFrom("teams").select(TEAM_COLUMNS).whereRef("teams.id", "=", `games.${column}`),
  ).$notNull();
}

export class KyselyGamesRepository implements GamesRepository {
  constructor(private readonly db: Database) {}

  list_games(filter: GameFilter): Promise<GameRow[]> {
    let query = this.select_games()
      .where("games.start_time", ">=", filter.start)
      .where("games.start_time", "<", filter.end);
    if (filter.team_id) {
      const team_id = filter.team_id;
      query = query.where((eb) =>
        eb.or([eb("games.home_team_id", "=", team_id), eb("games.away_team_id", "=", team_id)]),
      );
    }
    if (filter.statuses && filter.statuses.length > 0) {
      query = query.where("games.status", "in", filter.statuses);
    }
    return query.orderBy("games.start_time").orderBy("games.id").execute();
  }

  find_game(game_id: string): Promise<GameRow | undefined> {
    return this.select_games().where("games.id", "=", game_id).executeTakeFirst();
  }

  list_events(game_id: string): Promise<EventRow[]> {
    return this.db
      .selectFrom("game_events")
      .select((eb) => [
        "game_events.id",
        "game_events.event_type",
        "game_events.period",
        "game_events.game_time_seconds",
        "game_events.team_id",
        jsonObjectFrom(
          eb
            .selectFrom("players as scorer")
            .select(["scorer.id", "scorer.first_name", "scorer.last_name", "scorer.jersey_number"])
            .whereRef("scorer.id", "=", "game_events.player_id"),
        ).as("player"),
        jsonArrayFrom(
          eb
            .selectFrom("players as assist")
            .select(["assist.id", "assist.first_name", "assist.last_name", "assist.jersey_number"])
            .where(sql<boolean>`assist.id = ANY(game_events.assist_player_ids)`)
            .orderBy(sql`array_position(game_events.assist_player_ids, assist.id)`),
        ).as("assists"),
        sql<number | null>`(game_events.raw->>'penaltyMinutes')::int`.as("penalty_minutes"),
      ])
      .where("game_events.game_id", "=", game_id)
      .orderBy("game_events.game_time_seconds")
      .orderBy("game_events.period")
      .execute();
  }

  find_latest_final_game(
    team_external_id: string,
    data_source: "liiga_api" | "demo",
  ): Promise<GameRow | undefined> {
    return this.select_games()
      .innerJoin("teams as featured", (join) =>
        join
          .on("featured.external_id", "=", team_external_id)
          .on((eb) =>
            eb.or([
              eb("featured.id", "=", eb.ref("games.home_team_id")),
              eb("featured.id", "=", eb.ref("games.away_team_id")),
            ]),
          ),
      )
      .where("games.status", "=", "final")
      .where("games.data_source", "=", data_source)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("game_events")
            .select("game_events.id")
            .whereRef("game_events.game_id", "=", "games.id")
            .where("game_events.event_type", "=", "goal"),
        ),
      )
      .orderBy("games.start_time", "desc")
      .limit(1)
      .executeTakeFirst();
  }

  find_latest_demo_final(): Promise<GameRow | undefined> {
    return this.select_games()
      .where("games.status", "=", "final")
      .where("games.data_source", "=", "demo")
      .orderBy("games.start_time", "desc")
      .limit(1)
      .executeTakeFirst();
  }

  private select_games() {
    return this.db
      .selectFrom("games")
      .select((eb) => [
        "games.id",
        "games.external_id",
        "games.season",
        "games.start_time",
        "games.status",
        "games.period",
        "games.game_clock_seconds",
        "games.home_goals",
        "games.away_goals",
        "games.ended_in",
        "games.data_source",
        team_object(eb, "home_team_id").as("home_team"),
        team_object(eb, "away_team_id").as("away_team"),
      ]);
  }
}
