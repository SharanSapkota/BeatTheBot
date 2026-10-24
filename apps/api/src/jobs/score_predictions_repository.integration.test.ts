import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_NOW } from "../test_helpers/create_test_app";
import { seed_fixture_database } from "../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../test_helpers/test_database";
import { ScorePredictionsJob } from "./score_predictions";
import { KyselyScorePredictionsRepository } from "./score_predictions_repository";

const db = create_test_database();
const job = new ScorePredictionsJob(
  new KyselyScorePredictionsRepository(db),
  pino({ level: "silent" }),
  () => TEST_NOW,
);

beforeAll(async () => {
  // The seed gives 5 demo users picks on one finished game, unscored.
  await seed_fixture_database(db);
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("ScorePredictionsJob on the database", () => {
  it("scores the demo picks once: exact score + scorer beats a wrong pick", async () => {
    const first = await job.run();
    const second = await job.run();

    expect(first).toEqual({ scored_game_count: 1, scored_prediction_count: 5 });
    expect(second).toEqual({ scored_game_count: 0, scored_prediction_count: 0 });
    const rows = await db
      .selectFrom("user_predictions")
      .innerJoin("users", "users.id", "user_predictions.user_id")
      .select([
        "users.display_name",
        "user_predictions.points_awarded",
        "user_predictions.scored_at",
      ])
      .execute();
    const points = Object.fromEntries(rows.map((row) => [row.display_name, row.points_awarded]));
    // MikaK_Oulu: right winner and exact score (+ scorer when that player scored).
    expect(points["MikaK_Oulu"]).toBeGreaterThanOrEqual(35);
    // Erik_Vaasa: wrong winner, wrong score, no scorer.
    expect(points["Erik_Vaasa"]).toBe(0);
    expect(rows.every((row) => row.scored_at?.toISOString() === TEST_NOW.toISOString())).toBe(true);
  });
});
