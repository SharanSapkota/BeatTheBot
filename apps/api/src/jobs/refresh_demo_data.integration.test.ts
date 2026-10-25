import { pino } from "pino";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_NOW } from "../test_helpers/create_test_app";
import { seed_fixture_database } from "../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../test_helpers/test_database";
import type { JobTrigger } from "./job_scheduler";
import { RefreshDemoDataJob } from "./refresh_demo_data";
import { KyselyRefreshDemoDataRepository } from "./refresh_demo_data_repository";

const db = create_test_database();
const DAY_MS = 24 * 60 * 60 * 1000;
const logger = pino({ level: "silent" });

class CountingTrigger implements JobTrigger {
  runs = 0;
  request_run(): void {
    this.runs += 1;
  }
}

function job_at(now: Date, trigger = new CountingTrigger()) {
  return new RefreshDemoDataJob(new KyselyRefreshDemoDataRepository(db), logger, () => now, [
    trigger,
  ]);
}

async function sample_games(status: string) {
  return db
    .selectFrom("games")
    .select(["id", "external_id", "home_goals", "away_goals", "start_time"])
    .where("data_source", "=", "demo")
    .where("sport", "<>", "hockey")
    .where("status", "=", status)
    .execute();
}

beforeAll(async () => {
  await seed_fixture_database(db);
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("RefreshDemoDataJob", () => {
  // Three days after the seed: the seed's "today" and next-two-days games have been played.
  const later = new Date(TEST_NOW.getTime() + 3 * DAY_MS);

  it("removes demo hockey games, finishes passed sample games and fills the coming week", async () => {
    const scheduled_before = await sample_games("scheduled");
    const trigger = new CountingTrigger();
    const result = await job_at(later, trigger).run();

    expect(result.hockey_demo_games_removed).toBeGreaterThan(0);
    const demo_hockey = await db
      .selectFrom("games")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("sport", "=", "hockey")
      .where("data_source", "=", "demo")
      .executeTakeFirstOrThrow();
    expect(demo_hockey.count).toBe(0);

    const passed = scheduled_before.filter(
      (game) => game.start_time.getTime() < later.getTime() - 2 * 60 * 60 * 1000,
    );
    expect(result.sample_games_finished).toBe(passed.length);
    const finals = await sample_games("final");
    for (const game of passed) {
      const final = finals.find((row) => row.id === game.id);
      expect(final?.home_goals).not.toBeNull();
    }
    expect(trigger.runs).toBe(1);

    // Every day of the coming week has a sample game in each sport.
    const upcoming = await sample_games("scheduled");
    expect(upcoming.every((game) => game.start_time > later)).toBe(true);
    expect(result.sample_games_added).toBeGreaterThan(0);
    const days = new Set(upcoming.map((game) => game.external_id.split(":").slice(0, 3).join(":")));
    expect(days.size).toBeGreaterThanOrEqual(12);
  });

  it("is idempotent: a second run changes nothing", async () => {
    const trigger = new CountingTrigger();
    const result = await job_at(later, trigger).run();
    expect(result).toEqual({
      hockey_demo_games_removed: 0,
      sample_games_finished: 0,
      sample_games_added: 0,
      election_moved: false,
    });
    expect(trigger.runs).toBe(0);
  });

  it("keeps finished games' goal events in step with the score", async () => {
    const goals = await db
      .selectFrom("games")
      .leftJoin("game_events", "game_events.game_id", "games.id")
      .select([
        "games.id",
        "games.home_goals",
        "games.away_goals",
        sql<number>`count(game_events.id)::int`.as("events"),
      ])
      .where("games.sport", "=", "football")
      .where("games.status", "=", "final")
      .groupBy(["games.id", "games.home_goals", "games.away_goals"])
      .execute();
    for (const game of goals) {
      expect(game.events).toBe((game.home_goals ?? 0) + (game.away_goals ?? 0));
    }
  });

  it("moves the demo election ahead once its poll closes within a week", async () => {
    const near_the_vote = new Date(TEST_NOW.getTime() + 18 * DAY_MS);
    const result = await job_at(near_the_vote).run();
    expect(result.election_moved).toBe(true);
    const election = await db
      .selectFrom("elections")
      .select(["poll_closes_at", "poll_opens_at"])
      .where("is_demo", "=", true)
      .executeTakeFirstOrThrow();
    expect(election.poll_closes_at.getTime()).toBeGreaterThan(
      near_the_vote.getTime() + 14 * DAY_MS,
    );
    expect(election.poll_opens_at.getTime()).toBeLessThan(near_the_vote.getTime());
  });
});
