import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FixtureLiigaClient } from "../../integrations/liiga_client/fixture_liiga_client";
import { SyncGamesJob } from "../../jobs/sync_games";
import { KyselySyncGamesRepository } from "../../jobs/sync_games_repository";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { seed_demo_data, type SeedSummary } from "./seed_demo_data";

// 12:00 in Helsinki. The fixtures have one real game today: Kärpät - KalPa at 17:00, not started.
const now = new Date("2026-10-24T09:00:00Z");
const editor_email = "editor@test.local";
const db = create_test_database();

async function count_games(data_source: "liiga_api" | "demo") {
  const row = await db
    .selectFrom("games")
    .select(sql<number>`count(*)::int`.as("count"))
    .where("data_source", "=", data_source)
    .executeTakeFirstOrThrow();
  return row.count;
}

async function find_demo_game(external_id: string) {
  return db
    .selectFrom("games")
    .innerJoin("teams as home", "home.id", "games.home_team_id")
    .innerJoin("teams as away", "away.id", "games.away_team_id")
    .select([
      "games.id",
      "games.status",
      "games.home_goals",
      "games.away_goals",
      "games.ended_in",
      "games.data_source",
      "home.name as home_name",
      "away.name as away_name",
      "home.data_source as home_source",
    ])
    .where("games.external_id", "=", external_id)
    .executeTakeFirstOrThrow();
}

describe("seed_demo_data (test database)", () => {
  let summary: SeedSummary;

  beforeAll(async () => {
    await reset_test_database(db);
    const job = new SyncGamesJob(
      new FixtureLiigaClient(),
      new KyselySyncGamesRepository(db),
      () => now,
    );
    await job.run();
    await seed_demo_data(db, { now, editor_email });
    // Seeding twice must not create duplicates.
    summary = await seed_demo_data(db, { now, editor_email });
  });

  afterAll(async () => {
    await reset_test_database(db);
    await db.destroy();
  });

  it("keeps all Liiga games and only adds the missing hub states", async () => {
    expect(await count_games("liiga_api")).toBe(9);
    expect(await count_games("demo")).toBe(2);
    expect(summary).toMatchObject({
      demo_game_count: 2,
      demo_event_count: 6,
      unfilled_states: [],
    });
    // The real Kärpät game today is upcoming, so no demo upcoming game is needed.
    await expect(find_demo_game("demo_upcoming")).rejects.toThrow();
  });

  it("creates a 3-1 demo final and a 1-1 live game between real teams that are free today", async () => {
    const final = await find_demo_game("demo_final");
    const live = await find_demo_game("demo_live");
    const playing_today = ["Kärpät", "KalPa"];

    expect(final).toMatchObject({
      status: "final",
      home_goals: 3,
      away_goals: 1,
      ended_in: "regulation",
      data_source: "demo",
      home_source: "liiga_api",
    });
    expect(live).toMatchObject({ status: "live", home_goals: 1, away_goals: 1, ended_in: null });
    for (const game of [final, live]) {
      expect(playing_today).not.toContain(game.home_name);
      expect(playing_today).not.toContain(game.away_name);
    }
  });

  it("uses real forwards of the right team as demo goal scorers", async () => {
    const goals = await db
      .selectFrom("game_events")
      .innerJoin("players", "players.id", "game_events.player_id")
      .select([
        "game_events.data_source",
        "players.data_source as player_source",
        "players.position",
        sql<boolean>`players.team_id = game_events.team_id`.as("same_team"),
      ])
      .where("game_events.data_source", "=", "demo")
      .execute();

    expect(goals).toHaveLength(6);
    expect(goals.every((goal) => goal.player_source === "liiga_api")).toBe(true);
    expect(goals.every((goal) => goal.position === "forward" && goal.same_team)).toBe(true);
  });

  it("creates one editor and five players, each with a device identity", async () => {
    const users = await db
      .selectFrom("users")
      .innerJoin("auth_identities", "auth_identities.user_id", "users.id")
      .select(["users.role", "users.email", "auth_identities.provider"])
      .execute();

    expect(users).toHaveLength(6);
    expect(users.every((user) => user.provider === "device")).toBe(true);
    expect(users.filter((user) => user.role === "editor").map((user) => user.email)).toEqual([
      editor_email,
    ]);
  });

  it("adds five unscored picks on the demo final, made before puck drop", async () => {
    const picks = await db
      .selectFrom("user_predictions")
      .innerJoin("games", "games.id", "user_predictions.game_id")
      .select([
        "games.external_id",
        "user_predictions.points_awarded",
        sql<boolean>`user_predictions.created_at < games.start_time`.as("before_start"),
      ])
      .execute();

    expect(summary.prediction_count).toBe(5);
    expect(picks).toHaveLength(5);
    expect(picks.every((pick) => pick.external_id === "demo_final")).toBe(true);
    expect(picks.every((pick) => pick.points_awarded === null && pick.before_start)).toBe(true);
  });
});

describe("seed_demo_data without synced data", () => {
  it("asks to run the Liiga sync first", async () => {
    const empty_db = create_test_database();
    try {
      await reset_test_database(empty_db);
      await expect(seed_demo_data(empty_db, { now, editor_email })).rejects.toThrow(/sync/);
    } finally {
      await empty_db.destroy();
    }
  });
});
