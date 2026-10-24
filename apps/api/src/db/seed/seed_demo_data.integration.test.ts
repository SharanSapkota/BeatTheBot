import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FixtureLiigaClient } from "../../integrations/liiga_client/fixture_liiga_client";
import { SyncGamesJob } from "../../jobs/sync_games";
import { KyselySyncGamesRepository } from "../../jobs/sync_games_repository";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { DEMO_VOTER_DEVICE_PREFIX } from "./demo_election";
import { DEMO_ROOM_DEVICE_PREFIX, DEMO_ROOM_PAST_QUESTIONS } from "./demo_room";
import { seed_demo_data, type SeedSummary } from "./seed_demo_data";

// 12:00 in Helsinki. The fixtures have one real game today: Kärpät - KalPa at 17:00, not started.
const now = new Date("2026-10-24T09:00:00Z");
const editor_email = "editor@test.local";
const db = create_test_database();

async function count_games(data_source: "liiga_api" | "demo", sport = "hockey") {
  const row = await db
    .selectFrom("games")
    .select(sql<number>`count(*)::int`.as("count"))
    .where("data_source", "=", data_source)
    .where("sport", "=", sport)
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
      .innerJoin("games", "games.id", "game_events.game_id")
      .where("game_events.data_source", "=", "demo")
      .where("games.sport", "=", "hockey")
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
      .where("auth_identities.provider_subject", "not like", `${DEMO_VOTER_DEVICE_PREFIX}%`)
      .where("auth_identities.provider_subject", "not like", `${DEMO_ROOM_DEVICE_PREFIX}%`)
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
      .where("games.sport", "=", "hockey")
      .execute();

    expect(summary.prediction_count).toBe(5);
    expect(picks).toHaveLength(5);
    expect(picks.every((pick) => pick.external_id === "demo_final")).toBe(true);
    expect(picks.every((pick) => pick.points_awarded === null && pick.before_start)).toBe(true);
  });

  it("adds sample football and basketball fixtures for today, this week and two finished days", async () => {
    const games = await db
      .selectFrom("games")
      .innerJoin("leagues", "leagues.id", "games.league_id")
      .select(["games.sport", "games.status", "games.data_source", "leagues.name as league"])
      .where("games.sport", "<>", "hockey")
      .execute();

    expect(summary.sample_game_count).toBe(16);
    expect(games).toHaveLength(16);
    expect(games.every((game) => game.data_source === "demo")).toBe(true);
    expect(await count_games("demo", "football")).toBe(9);
    expect(await count_games("demo", "basketball")).toBe(7);
    expect(new Set(games.map((game) => `${game.sport}:${game.league}`))).toEqual(
      new Set(["football:Veikkausliiga", "basketball:Korisliiga"]),
    );
    expect(games.filter((game) => game.status === "final")).toHaveLength(6);
  });

  it("keeps sample teams and players between seeds and gives the finals scorers and picks", async () => {
    const teams = await db
      .selectFrom("teams")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("sport", "<>", "hockey")
      .executeTakeFirstOrThrow();
    const draw = await db
      .selectFrom("games")
      .innerJoin("teams as home", "home.id", "games.home_team_id")
      .select(["games.id", "games.home_goals", "games.away_goals"])
      .where("home.name", "=", "KuPS")
      .where("games.status", "=", "final")
      .executeTakeFirstOrThrow();
    const draw_goals = await db
      .selectFrom("game_events")
      .select("player_id")
      .where("game_id", "=", draw.id)
      .execute();
    const basketball_finals = await db
      .selectFrom("games")
      .select("top_scorer_player_id")
      .where("sport", "=", "basketball")
      .where("status", "=", "final")
      .execute();
    const sample_picks = await db
      .selectFrom("user_predictions")
      .innerJoin("games", "games.id", "user_predictions.game_id")
      .select(["user_predictions.predicted_winner_team_id", "games.sport"])
      .where("games.sport", "<>", "hockey")
      .execute();

    expect(teams.count).toBe(14);
    expect(draw).toMatchObject({ home_goals: 1, away_goals: 1 });
    expect(draw_goals).toHaveLength(2);
    expect(basketball_finals.every((game) => game.top_scorer_player_id !== null)).toBe(true);
    expect(summary.sample_pick_count).toBe(30);
    expect(sample_picks).toHaveLength(30);
    // Two football draw picks per finished football game.
    expect(sample_picks.filter((pick) => pick.predicted_winner_team_id === null)).toHaveLength(6);
  });

  it("adds one published demo election with 5 fictional candidates and 30 demo picks", async () => {
    const election = await db
      .selectFrom("elections")
      .select(["id", "status", "is_demo", "area_name"])
      .executeTakeFirstOrThrow();
    const candidates = await db
      .selectFrom("election_candidates")
      .select("full_name")
      .where("election_id", "=", election.id)
      .execute();
    const picks = await db
      .selectFrom("election_picks")
      .select("id")
      .where("election_id", "=", election.id)
      .execute();

    expect(election).toMatchObject({ status: "published", is_demo: true, area_name: "Oulu" });
    expect(candidates).toHaveLength(5);
    expect(picks).toHaveLength(30);
    expect(summary.election_pick_count).toBe(30);
  });

  it("adds the demo room DEMO26 with 8 members and revealed questions with answers", async () => {
    const room = await db
      .selectFrom("rooms")
      .select(["id", "name", "join_key", "is_demo", "question_interval_seconds", "created_at"])
      .executeTakeFirstOrThrow();
    const members = await db
      .selectFrom("room_members")
      .select("role")
      .where("room_id", "=", room.id)
      .execute();
    const questions = await db
      .selectFrom("room_questions")
      .select(["prompt", "locks_at"])
      .where("room_id", "=", room.id)
      .execute();

    expect(room).toMatchObject({
      name: "Kärpät fans Oulu",
      join_key: "DEMO26",
      is_demo: true,
      question_interval_seconds: 60,
    });
    expect(members).toHaveLength(8);
    expect(members.filter((member) => member.role === "owner")).toHaveLength(1);
    expect(questions).toHaveLength(DEMO_ROOM_PAST_QUESTIONS);
    expect(new Set(questions.map((question) => question.prompt)).size).toBe(questions.length);
    expect(questions.every((question) => question.locks_at <= now)).toBe(true);
    expect(summary.room_answer_count).toBeGreaterThan(50);
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
