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
  it("ranks only the demo users (no AI, no 'all fans' row) for the season, publicly cacheable", async () => {
    const response = await request(app).get("/api/v1/leaderboard?period=season&sport=hockey");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=60");
    const { data } = leaderboard_response_schema.parse(response.body);
    expect(data.period).toBe("season");
    expect(data.sport).toBe("hockey");
    expect(data.rows).toHaveLength(5);
    expect(data.rows.every((row) => row.kind === "user")).toBe(true);
    expect(response.text).not.toContain("Kaleva AI");
    expect(data.rows[0]?.display_name).toBe("MikaK_Oulu");
    expect(data.summary.you_accuracy).toBeNull();
    expect(data.summary.fans_accuracy).toBeCloseTo(3 / 5);
    expect(data.summary.games_count).toBeGreaterThan(0);
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

  it("adds every sport on the Games tab (default) and filters one sport", async () => {
    const games_tab = leaderboard_response_schema.parse(
      (await request(app).get("/api/v1/leaderboard?period=season")).body,
    ).data;
    const football = leaderboard_response_schema.parse(
      (await request(app).get("/api/v1/leaderboard?period=season&sport=football")).body,
    ).data;
    const hockey = leaderboard_response_schema.parse(
      (await request(app).get("/api/v1/leaderboard?period=season&sport=hockey")).body,
    ).data;

    expect(games_tab.sport).toBe("all");
    expect(football.sport).toBe("football");
    // 3 finished sample football games; the Games tab counts every sport's finished games.
    expect(football.summary.games_count).toBe(3);
    expect(games_tab.summary.games_count).toBe(
      hockey.summary.games_count + football.summary.games_count + 3,
    );
    const points_of = (board: typeof games_tab, name: string) =>
      board.rows.find((row) => row.display_name === name)?.points ?? 0;
    expect(points_of(games_tab, "MikaK_Oulu")).toBeGreaterThan(points_of(hockey, "MikaK_Oulu"));
    expect(response_has_no_ai(football)).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for an unknown sport", async () => {
    const response = await request(app).get("/api/v1/leaderboard?sport=curling");

    expect(response.status).toBe(400);
  });

  it("returns 400 VALIDATION_ERROR for an unknown period", async () => {
    const response = await request(app).get("/api/v1/leaderboard?period=year");

    expect(response.status).toBe(400);
  });
});

function response_has_no_ai(board: { rows: { display_name: string }[] }): boolean {
  return board.rows.every((row) => !/AI|all fans/i.test(row.display_name));
}
