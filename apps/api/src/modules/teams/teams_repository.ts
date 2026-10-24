import type { Sport } from "@voita_kone/shared_types";
import { sql, type ExpressionBuilder } from "kysely";
import type { DB } from "../../db/database_types";
import type { Database } from "../../db/kysely";
import type { TeamRow } from "./teams_mapper";

export interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  position: string | null;
  birth_year: number | null;
  season_goals: number;
  goals_last_5: number;
}

export interface TeamsRepository {
  list_teams(sport: Sport): Promise<TeamRow[]>;
  find_team(team_id: string): Promise<TeamRow | undefined>;
  /** The season of the sport's latest game, or undefined when it has no games. */
  find_current_season(sport: Sport): Promise<string | undefined>;
  /**
   * Players of a team with goals from counted games: hockey counts real Liiga games only (not
   * the demo fill-ins); other sports count every game (admin-entered and sample data).
   */
  list_players(team_id: string, season: string): Promise<PlayerRow[]>;
}

/** Games whose goals count for player stats (see `list_players`). */
function is_counted_game(eb: ExpressionBuilder<DB, "games">) {
  return eb.or([eb("games.data_source", "=", "liiga_api"), eb("games.sport", "<>", "hockey")]);
}

const TEAM_COLUMNS = [
  "id",
  "external_id",
  "name",
  "short_name",
  "city",
  "logo_url",
  "sport",
  "data_source",
] as const;
const LAST_GAME_COUNT = 5;

export class KyselyTeamsRepository implements TeamsRepository {
  constructor(private readonly db: Database) {}

  list_teams(sport: Sport): Promise<TeamRow[]> {
    return this.db
      .selectFrom("teams")
      .select(TEAM_COLUMNS)
      .where("sport", "=", sport)
      .orderBy("name")
      .execute();
  }

  find_team(team_id: string): Promise<TeamRow | undefined> {
    return this.db
      .selectFrom("teams")
      .select(TEAM_COLUMNS)
      .where("id", "=", team_id)
      .executeTakeFirst();
  }

  async find_current_season(sport: Sport): Promise<string | undefined> {
    const latest = await this.db
      .selectFrom("games")
      .select("season")
      .where("sport", "=", sport)
      .orderBy("start_time", "desc")
      .limit(1)
      .executeTakeFirst();
    return latest?.season;
  }

  list_players(team_id: string, season: string): Promise<PlayerRow[]> {
    const last_games = this.db
      .selectFrom("games")
      .select("id")
      .where("status", "=", "final")
      .where(is_counted_game)
      .where((eb) => eb.or([eb("home_team_id", "=", team_id), eb("away_team_id", "=", team_id)]))
      .orderBy("start_time", "desc")
      .limit(LAST_GAME_COUNT);

    return this.db
      .selectFrom("players")
      .select((eb) => [
        "players.id",
        "players.first_name",
        "players.last_name",
        "players.jersey_number",
        "players.position",
        "players.birth_year",
        eb
          .selectFrom("game_events")
          .innerJoin("games", "games.id", "game_events.game_id")
          .select(sql<number>`count(*)::int`.as("count"))
          .whereRef("game_events.player_id", "=", "players.id")
          .where("game_events.event_type", "=", "goal")
          .where(is_counted_game)
          .where("games.season", "=", season)
          .as("season_goals"),
        eb
          .selectFrom("game_events")
          .select(sql<number>`count(*)::int`.as("count"))
          .whereRef("game_events.player_id", "=", "players.id")
          .where("game_events.event_type", "=", "goal")
          .where("game_events.game_id", "in", last_games)
          .as("goals_last_5"),
      ])
      .where("players.team_id", "=", team_id)
      .execute()
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          season_goals: row.season_goals ?? 0,
          goals_last_5: row.goals_last_5 ?? 0,
        })),
      );
  }
}
