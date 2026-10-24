import type { Database } from "../../db/kysely";

// Reads what the prediction model needs. Real Liiga rows only: demo fill-ins never feed
// the model.

export interface ModelTeamRow {
  id: string;
  name: string;
}

export interface ModelGameRow {
  id: string;
  season: string;
  home_team_id: string;
  away_team_id: string;
  start_time: Date;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  ended_in: string | null;
}

export interface ModelPlayerRow {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  position: string | null;
}

export interface ModelGoalRow {
  game_id: string;
  team_id: string;
  player_id: string | null;
}

export interface SeasonRows {
  season: string;
  teams: ModelTeamRow[];
  games: ModelGameRow[];
  players: ModelPlayerRow[];
  goals: ModelGoalRow[];
}

export interface ModelInputsRepository {
  /** The season of the latest real game, or undefined when nothing is synced. */
  find_current_season(): Promise<string | undefined>;
  /** The season of a real Liiga game, or undefined (unknown or demo game). */
  find_game_season(game_id: string): Promise<string | undefined>;
  /** Teams, games, players and goals (no shootout attempts) of one season. */
  load_season(season: string): Promise<SeasonRows>;
}

const LIIGA = "liiga_api";
const SHOOTOUT_PERIOD = 5;

export class KyselyModelInputsRepository implements ModelInputsRepository {
  constructor(private readonly db: Database) {}

  async find_current_season(): Promise<string | undefined> {
    const row = await this.db
      .selectFrom("games")
      .select("season")
      .where("data_source", "=", LIIGA)
      .orderBy("start_time", "desc")
      .limit(1)
      .executeTakeFirst();
    return row?.season;
  }

  async find_game_season(game_id: string): Promise<string | undefined> {
    const row = await this.db
      .selectFrom("games")
      .select("season")
      .where("id", "=", game_id)
      .where("data_source", "=", LIIGA)
      .executeTakeFirst();
    return row?.season;
  }

  async load_season(season: string): Promise<SeasonRows> {
    const games = await this.db
      .selectFrom("games")
      .select([
        "id",
        "season",
        "home_team_id",
        "away_team_id",
        "start_time",
        "status",
        "home_goals",
        "away_goals",
        "ended_in",
      ])
      .where("season", "=", season)
      .where("data_source", "=", LIIGA)
      .orderBy("start_time")
      .orderBy("id")
      .execute();
    const team_ids = [...new Set(games.flatMap((game) => [game.home_team_id, game.away_team_id]))];
    if (team_ids.length === 0) {
      return { season, teams: [], games, players: [], goals: [] };
    }

    const [teams, players, goals] = await Promise.all([
      this.db
        .selectFrom("teams")
        .select(["id", "name"])
        .where("id", "in", team_ids)
        .orderBy("name")
        .execute(),
      this.db
        .selectFrom("players")
        .select(["id", "team_id", "first_name", "last_name", "jersey_number", "position"])
        .where("team_id", "in", team_ids)
        .where("data_source", "=", LIIGA)
        .execute(),
      this.db
        .selectFrom("game_events")
        .innerJoin("games", "games.id", "game_events.game_id")
        .select(["game_events.game_id", "game_events.team_id", "game_events.player_id"])
        .where("games.season", "=", season)
        .where("games.data_source", "=", LIIGA)
        .where("game_events.event_type", "=", "goal")
        .where("game_events.period", "<", SHOOTOUT_PERIOD)
        .where("game_events.team_id", "is not", null)
        .execute(),
    ]);
    return {
      season,
      teams,
      games,
      players,
      goals: goals.flatMap((goal) =>
        goal.team_id
          ? [{ game_id: goal.game_id, team_id: goal.team_id, player_id: goal.player_id }]
          : [],
      ),
    };
  }
}
