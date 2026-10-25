import type { Database } from "../db/kysely";
import type { DemoElection } from "../db/seed/demo_election";
import {
  build_sample_fixtures,
  upsert_teams_and_players,
  type SampleGame,
} from "../db/seed/demo_sports";

const DEMO = "demo";

export interface PassedSampleGame {
  id: string;
  external_id: string;
  start_time: Date;
}

export interface RefreshDemoDataRepository {
  /** Hockey has real Liiga data: demo hockey games are removed (cascades to their rows). */
  delete_hockey_demo_games(): Promise<number>;
  /** Scheduled sample games (football, basketball) that started before `before`. */
  list_passed_sample_games(before: Date): Promise<PassedSampleGame[]>;
  /** Saves the final: score, top scorer and goal events. */
  finish_sample_game(game_id: string, final: SampleGame): Promise<void>;
  /** Start times of sample games from `from` on, by sport. */
  list_sample_starts(from: Date): Promise<{ sport: string; start_time: Date }[]>;
  /** Inserts new sample games (an existing external id is left alone). Returns how many. */
  insert_sample_games(games: readonly SampleGame[], now: Date): Promise<number>;
  find_demo_election(): Promise<{ id: string; poll_closes_at: Date; status: string } | undefined>;
  move_demo_election(
    election_id: string,
    dates: Pick<DemoElection, "election_date" | "poll_opens_at" | "poll_closes_at">,
  ): Promise<void>;
}

export class KyselyRefreshDemoDataRepository implements RefreshDemoDataRepository {
  constructor(private readonly db: Database) {}

  async delete_hockey_demo_games(): Promise<number> {
    const result = await this.db
      .deleteFrom("games")
      .where("sport", "=", "hockey")
      .where("data_source", "=", DEMO)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  list_passed_sample_games(before: Date): Promise<PassedSampleGame[]> {
    return this.db
      .selectFrom("games")
      .select(["id", "external_id", "start_time"])
      .where("data_source", "=", DEMO)
      .where("sport", "<>", "hockey")
      .where("status", "=", "scheduled")
      .where("start_time", "<", before)
      .orderBy("start_time")
      .execute();
  }

  async finish_sample_game(game_id: string, final: SampleGame): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const players = await trx
        .selectFrom("players")
        .innerJoin("teams", "teams.id", "players.team_id")
        .select([
          "players.id",
          "players.external_id",
          "teams.external_id as team_external_id",
          "teams.id as team_id",
        ])
        .where("teams.external_id", "in", [
          final.home_team_external_id,
          final.away_team_external_id,
        ])
        .execute();
      const player_id = (external_id: string | null) =>
        players.find((player) => player.external_id === external_id)?.id ?? null;
      const team_id = (external_id: string) =>
        players.find((player) => player.team_external_id === external_id)?.team_id ?? null;
      await trx
        .updateTable("games")
        .set({
          status: "final",
          home_goals: final.home_goals,
          away_goals: final.away_goals,
          ended_in: final.ended_in,
          period: final.period,
          top_scorer_player_id: player_id(final.top_scorer_external_id),
        })
        .where("id", "=", game_id)
        .where("status", "=", "scheduled")
        .execute();
      await trx.deleteFrom("game_events").where("game_id", "=", game_id).execute();
      const events = final.goals.map((goal) => ({
        game_id,
        event_type: "goal",
        period: goal.period,
        game_time_seconds: goal.game_time_seconds,
        team_id: team_id(goal.team_external_id),
        player_id: player_id(goal.player_external_id),
        data_source: DEMO,
      }));
      if (events.length > 0) {
        await trx.insertInto("game_events").values(events).execute();
      }
    });
  }

  list_sample_starts(from: Date): Promise<{ sport: string; start_time: Date }[]> {
    return this.db
      .selectFrom("games")
      .select(["sport", "start_time"])
      .where("data_source", "=", DEMO)
      .where("sport", "<>", "hockey")
      .where("start_time", ">=", from)
      .execute();
  }

  insert_sample_games(games: readonly SampleGame[], now: Date): Promise<number> {
    if (games.length === 0) {
      return Promise.resolve(0);
    }
    return this.db.transaction().execute(async (trx) => {
      // The sample teams and players may not exist yet (a database that was never seeded).
      const { teams, players } = build_sample_fixtures(now);
      const { team_ids } = await upsert_teams_and_players(trx, { teams, players });
      const rows = games.flatMap((game) => {
        const home_team_id = team_ids.get(game.home_team_external_id);
        const away_team_id = team_ids.get(game.away_team_external_id);
        if (!home_team_id || !away_team_id) {
          return [];
        }
        return [
          {
            external_id: game.external_id,
            sport: game.sport,
            league_id: game.league_id,
            season: game.season,
            home_team_id,
            away_team_id,
            start_time: game.start_time,
            status: game.status,
            data_source: DEMO,
          },
        ];
      });
      const inserted = await trx
        .insertInto("games")
        .values(rows)
        .onConflict((conflict) => conflict.column("external_id").doNothing())
        .returning("id")
        .execute();
      return inserted.length;
    });
  }

  find_demo_election(): Promise<{ id: string; poll_closes_at: Date; status: string } | undefined> {
    return this.db
      .selectFrom("elections")
      .select(["id", "poll_closes_at", "status"])
      .where("is_demo", "=", true)
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();
  }

  async move_demo_election(
    election_id: string,
    dates: Pick<DemoElection, "election_date" | "poll_opens_at" | "poll_closes_at">,
  ): Promise<void> {
    await this.db.updateTable("elections").set(dates).where("id", "=", election_id).execute();
  }
}
