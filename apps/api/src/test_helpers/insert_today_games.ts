import { season_config } from "@voita_kone/prediction_model";
import type { Transaction } from "kysely";
import type { DB } from "../db/database_types";
import type { Database } from "../db/kysely";
import { add_days, get_helsinki_date, helsinki_time } from "../db/seed/helsinki_time";
import { build_demo_fill, type FillTeam, type HubState } from "./demo_fill";

// Tests only: the hockey games of the test day (see demo_fill.ts). Production has real Liiga
// data only, so the seed no longer adds demo hockey games.

const DEMO = "demo";
const STATE_BY_STATUS: Record<string, HubState> = {
  scheduled: "upcoming",
  live: "live",
  final: "final",
};

export interface TodayGamesSummary {
  demo_game_count: number;
  demo_event_count: number;
  unfilled_states: HubState[];
}

/** Hockey fill-ins use Liiga teams only (football and basketball have sample fixtures). */
async function load_fill_teams(trx: Transaction<DB>): Promise<FillTeam[]> {
  const teams = await trx
    .selectFrom("teams")
    .select(["id", "name"])
    .where("sport", "=", "hockey")
    .execute();
  if (teams.length === 0) {
    throw new Error(
      "No teams in the database. Run the Liiga sync first: pnpm --filter api sync:liiga",
    );
  }
  const forwards = await trx
    .selectFrom("players")
    .select(["id", "team_id"])
    .where("position", "=", "forward")
    .orderBy("jersey_number", (order) => order.asc().nullsLast())
    .orderBy("last_name")
    .execute();
  return teams.map((team) => ({
    ...team,
    forward_ids: forwards.filter((player) => player.team_id === team.id).map((player) => player.id),
  }));
}

async function load_todays_games(trx: Transaction<DB>, now: Date) {
  const today = get_helsinki_date(now);
  return trx
    .selectFrom("games")
    .select(["status", "home_team_id", "away_team_id"])
    .where("sport", "=", "hockey")
    .where("start_time", ">=", helsinki_time(today, 0, 0))
    .where("start_time", "<", helsinki_time(add_days(today, 1), 0, 0))
    .execute();
}

async function load_season(trx: Transaction<DB>): Promise<string> {
  const latest = await trx
    .selectFrom("games")
    .select("season")
    .where("sport", "=", "hockey")
    .orderBy("start_time", "desc")
    .limit(1)
    .executeTakeFirst();
  return latest?.season ?? season_config.season;
}

/** Adds a demo hockey game for each state the test day has no real game in. */
export async function insert_today_games(db: Database, now: Date): Promise<TodayGamesSummary> {
  return db.transaction().execute(async (trx) => {
    const teams = await load_fill_teams(trx);
    const todays_games = await load_todays_games(trx, now);
    const fill = build_demo_fill({
      now,
      season: await load_season(trx),
      teams,
      todays_states: new Set(todays_games.flatMap((game) => STATE_BY_STATUS[game.status] ?? [])),
      busy_team_ids: new Set(
        todays_games.flatMap((game) => [game.home_team_id, game.away_team_id]),
      ),
    });
    if (fill.games.length > 0) {
      const game_rows = await trx
        .insertInto("games")
        .values(fill.games.map((game) => ({ ...game, data_source: DEMO })))
        .returning(["id", "external_id"])
        .execute();
      const game_ids = new Map(game_rows.map((row) => [row.external_id, row.id]));
      const event_rows = fill.events.flatMap(({ game_external_id, ...event }) => {
        const game_id = game_ids.get(game_external_id);
        return game_id ? [{ ...event, game_id, event_type: "goal", data_source: DEMO }] : [];
      });
      if (event_rows.length > 0) {
        await trx.insertInto("game_events").values(event_rows).execute();
      }
    }
    return {
      demo_game_count: fill.games.length,
      demo_event_count: fill.events.length,
      unfilled_states: fill.unfilled_states,
    };
  });
}
