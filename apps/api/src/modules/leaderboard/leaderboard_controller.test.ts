import { auth_result_response_schema, leaderboard_response_schema } from "@voita_kone/shared_types";
import { pino } from "pino";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScorePredictionsJob } from "../../jobs/score_predictions";
import { KyselyScorePredictionsRepository } from "../../jobs/score_predictions_repository";
import { TEST_NOW, create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({ db });

beforeAll(async () => {
  // 5 demo users picked one finished game; score them as the API would.
  await seed_fixture_database(db);
  await new ScorePredictionsJob(
    new KyselyScorePredictionsRepository(db),
    pino({ level: "silent" }),
    () => TEST_NOW,
  ).run();
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("GET /api/v1/leaderboard", () => {
  it("ranks the demo users and the AI for the season, publicly cacheable", async () => {
    const response = await request(app).get("/api/v1/leaderboard?period=season");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=60");
    const { data } = leaderboard_response_schema.parse(response.body);
    expect(data.period).toBe("season");
    expect(data.rows.filter((row) => row.kind === "user")).toHaveLength(5);
    expect(data.rows.some((row) => row.kind === "ai")).toBe(true);
    expect(data.rows[0]?.display_name).toBe("MikaK_Oulu");
    expect(data.accuracy.you).toBeNull();
    expect(data.accuracy.fans).toBeCloseTo(3 / 5);
  });

  it("defaults to the week, and is private when signed in", async () => {
    const auth = await request(app).post("/api/v1/auth/device").send({ display_name: "New fan" });
    const token = auth_result_response_schema.parse(auth.body).data.token;

    const response = await request(app)
      .get("/api/v1/leaderboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const { data } = leaderboard_response_schema.parse(response.body);
    expect(data.period).toBe("week");
    // A new user without scored picks has no row yet.
    expect(data.rows.some((row) => row.kind === "you")).toBe(false);
  });

  it("returns 400 VALIDATION_ERROR for an unknown period", async () => {
    const response = await request(app).get("/api/v1/leaderboard?period=year");

    expect(response.status).toBe(400);
  });
});
