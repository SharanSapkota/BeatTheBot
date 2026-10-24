import { sql } from "kysely";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FixtureLiigaClient } from "../integrations/liiga_client/fixture_liiga_client";
import { map_game, map_game_events } from "../integrations/liiga_client/liiga_mapper";
import { create_test_database, reset_test_database } from "../test_helpers/test_database";
import { SyncGamesJob } from "./sync_games";
import { KyselySyncGamesRepository } from "./sync_games_repository";

const NOW = new Date("2026-10-24T09:00:00Z");
const db = create_test_database();

function create_job() {
  return new SyncGamesJob(new FixtureLiigaClient(), new KyselySyncGamesRepository(db), () => NOW);
}

async function count_rows(
  table: "teams" | "players" | "games" | "game_events" | "standings_snapshots",
) {
  const row = await db
    .selectFrom(table)
    .select(sql<number>`count(*)::int`.as("count"))
    .executeTakeFirstOrThrow();
  return row.count;
}

describe("KyselySyncGamesRepository (test database)", () => {
  beforeEach(async () => {
    await reset_test_database(db);
  });

  afterAll(async () => {
    await reset_test_database(db);
    await db.destroy();
  });

  it("stores the Liiga data and creates no duplicates when synced twice", async () => {
    const first = await create_job().run();
    const second = await create_job().run();

    expect(second).toEqual(first);
    expect(await count_rows("teams")).toBe(17);
    expect(await count_rows("players")).toBe(63);
    expect(await count_rows("games")).toBe(9);
    expect(await count_rows("game_events")).toBe(first.event_count);
    expect(await count_rows("standings_snapshots")).toBe(17);
  });

  it("stores goal events that match every final score", async () => {
    await create_job().run();

    const mismatches = await db
      .selectFrom("games")
      .leftJoin("game_events", (join) =>
        join
          .onRef("game_events.game_id", "=", "games.id")
          .on("game_events.event_type", "=", "goal"),
      )
      .select([
        "games.external_id",
        "games.home_goals",
        "games.away_goals",
        sql<number>`count(*) FILTER (WHERE game_events.team_id = games.home_team_id)::int`.as(
          "home_events",
        ),
        sql<number>`count(*) FILTER (WHERE game_events.team_id = games.away_team_id)::int`.as(
          "away_events",
        ),
      ])
      .where("games.status", "=", "final")
      .groupBy("games.id")
      .having((eb) =>
        eb.or([
          eb(
            sql`count(*) FILTER (WHERE game_events.team_id = games.home_team_id)`,
            "<>",
            eb.ref("games.home_goals"),
          ),
          eb(
            sql`count(*) FILTER (WHERE game_events.team_id = games.away_team_id)`,
            "<>",
            eb.ref("games.away_goals"),
          ),
        ]),
      )
      .execute();

    expect(mismatches).toEqual([]);
  });

  it("marks synced rows as liiga_api and resolves scorers to our player ids", async () => {
    await create_job().run();

    const sources = await db.selectFrom("games").select("data_source").distinct().execute();
    const scorer = await db
      .selectFrom("game_events")
      .innerJoin("players", "players.id", "game_events.player_id")
      .select(["players.first_name", "players.last_name"])
      .where("game_events.event_type", "=", "goal")
      .where("players.external_id", "=", "31803661")
      .executeTakeFirst();

    expect(sources).toEqual([{ data_source: "liiga_api" }]);
    expect(scorer).toEqual({ first_name: "Eetu", last_name: "Päkkilä" });
  });

  it("never overwrites a demo row", async () => {
    await db
      .insertInto("teams")
      .values({
        external_id: "55786244:hpk",
        name: "Demo HPK",
        short_name: "DHPK",
        data_source: "demo",
      })
      .execute();

    await create_job().run();

    const hpk = await db
      .selectFrom("teams")
      .select(["name", "data_source"])
      .where("external_id", "=", "55786244:hpk")
      .executeTakeFirstOrThrow();
    expect(hpk).toEqual({ name: "Demo HPK", data_source: "demo" });
  });

  it("finds Liiga games that should be live: started, not final, not too old", async () => {
    await create_job().run();
    const repository = new KyselySyncGamesRepository(db);

    // Kärpät - KalPa starts 2026-10-24 14:00 UTC and is still "scheduled" in the fixtures.
    const before_start = await repository.find_due_games(
      new Date("2026-10-24T13:59:00Z"),
      new Date("2026-10-24T08:00:00Z"),
    );
    const after_start = await repository.find_due_games(
      new Date("2026-10-24T14:30:00Z"),
      new Date("2026-10-24T08:30:00Z"),
    );

    expect(before_start).toEqual([]);
    expect(after_start).toEqual([{ external_id: "2701412", season: "2026-27" }]);
  });

  it("saves a live update for one game and replaces its events", async () => {
    await create_job().run();
    const repository = new KyselySyncGamesRepository(db);
    const liiga_game = await new FixtureLiigaClient().get_game(2027, 2701412);
    const live_game = {
      ...liiga_game,
      started: true,
      currentPeriod: 2,
      gameTime: 1500,
      homeTeam: {
        ...liiga_game.homeTeam,
        goals: 1,
        goalEvents: [{ eventId: 1, scorerPlayerId: 31803661, period: 1, gameTime: 600 }],
      },
    };
    const mapped = map_game(live_game);
    if (!mapped) {
      throw new Error("not mapped");
    }

    await repository.save_games([mapped], map_game_events(live_game));
    await repository.save_games([mapped], map_game_events(live_game));

    const game = await db
      .selectFrom("games")
      .select(["id", "status", "home_goals", "away_goals", "period", "game_clock_seconds"])
      .where("external_id", "=", "2701412")
      .executeTakeFirstOrThrow();
    const events = await db
      .selectFrom("game_events")
      .select("player_id")
      .where("game_id", "=", game.id)
      .execute();
    expect(game).toMatchObject({
      status: "live",
      home_goals: 1,
      away_goals: 0,
      period: 2,
      game_clock_seconds: 1500,
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.player_id).not.toBeNull();
  });
});
