import {
  ai_prediction_response_schema,
  api_error_schema,
  game_day_response_schema,
  season_odds_response_schema,
  win_chance_response_schema,
} from "@voita_kone/shared_types";
import { pino } from "pino";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RunModelJob } from "../../jobs/run_model";
import { TEST_NOW, create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { KyselyAiPredictionsRepository } from "./ai_predictions_repository";
import { KyselyModelInputsRepository } from "./model_inputs_repository";

const db = create_test_database();
const app = create_test_app({ db });

function run_model(): Promise<unknown> {
  return new RunModelJob(
    new KyselyModelInputsRepository(db),
    new KyselyAiPredictionsRepository(db),
    pino({ level: "silent" }),
    () => TEST_NOW,
    { window_days: 7, season_simulations: 500, stakes_simulations: 200, seed: 1 },
  ).run();
}

async function game_id_where(
  filter: (query: ReturnType<typeof base_query>) => ReturnType<typeof base_query>,
): Promise<string> {
  return (await filter(base_query()).executeTakeFirstOrThrow()).id;
}

function base_query() {
  return db.selectFrom("games").select("id");
}

function error_of(body: unknown) {
  return api_error_schema.parse(body).error;
}

let karpat_game_id = "";

beforeAll(async () => {
  await seed_fixture_database(db);
  karpat_game_id = await game_id_where((query) => query.where("external_id", "=", "2701412"));
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("before the model has run", () => {
  it("GET /standings/odds says the odds are not ready", async () => {
    const response = await request(app).get("/api/v1/standings/odds");

    expect(response.status).toBe(404);
    expect(error_of(response.body).code).toBe("ODDS_NOT_READY");
  });

  it("GET /games/:id/ai_prediction says the pick is not ready, in plain words", async () => {
    const response = await request(app).get(`/api/v1/games/${karpat_game_id}/ai_prediction`);

    expect(response.status).toBe(404);
    expect(error_of(response.body)).toMatchObject({
      code: "PREDICTION_NOT_READY",
      message: expect.stringContaining("has not made its pick"),
    });
  });
});

describe("after the model has run", () => {
  beforeAll(async () => {
    await run_model();
  });

  it("GET /games/:id/ai_prediction returns the AI's pick for an upcoming game", async () => {
    const response = await request(app).get(`/api/v1/games/${karpat_game_id}/ai_prediction`);

    expect(response.status).toBe(200);
    const { data } = ai_prediction_response_schema.parse(response.body);
    expect(data.game_id).toBe(karpat_game_id);
    expect(data.home_win_probability + data.away_win_probability).toBeCloseTo(1, 10);
    expect(data.reasons.length).toBeGreaterThan(0);
    expect(data.stakes).toHaveLength(2);
    expect(data.label_text).toBe("AI's pick, calculated from game statistics");
    expect(data.calculated_at).toBe(TEST_NOW.toISOString());
    expect(response.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("names a real player of the predicted winner as the scorer", async () => {
    const { data } = ai_prediction_response_schema.parse(
      (await request(app).get(`/api/v1/games/${karpat_game_id}/ai_prediction`)).body,
    );
    const player = await db
      .selectFrom("players")
      .select(["team_id", "data_source"])
      .where("id", "=", data.predicted_scorer?.id ?? "")
      .executeTakeFirst();

    expect(player).toEqual({ team_id: data.predicted_winner_team_id, data_source: "liiga_api" });
  });

  it("404 PREDICTION_NOT_READY for a game more than 7 days ahead", async () => {
    const later_id = await game_id_where((query) =>
      query
        .where("start_time", ">", new Date(TEST_NOW.getTime() + 7 * 24 * 60 * 60 * 1000))
        .orderBy("start_time"),
    );

    const response = await request(app).get(`/api/v1/games/${later_id}/ai_prediction`);

    expect(response.status).toBe(404);
    expect(error_of(response.body).code).toBe("PREDICTION_NOT_READY");
  });

  it("never predicts demo fill-in games", async () => {
    const demo_id = await game_id_where((query) => query.where("data_source", "=", "demo"));

    const response = await request(app).get(`/api/v1/games/${demo_id}/ai_prediction`);

    expect(error_of(response.body).code).toBe("PREDICTION_NOT_READY");
  });

  it("404 GAME_NOT_FOUND for an unknown or malformed id", async () => {
    const unknown = await request(app).get(
      "/api/v1/games/00000000-0000-4000-8000-000000000000/ai_prediction",
    );
    const malformed = await request(app).get("/api/v1/games/not-a-uuid/ai_prediction");

    expect(error_of(unknown.body).code).toBe("GAME_NOT_FOUND");
    expect(malformed.status).toBe(404);
    expect(error_of(malformed.body).code).toBe("GAME_NOT_FOUND");
  });

  it("409 GAME_NOT_STARTED for the win chance of an upcoming game", async () => {
    const response = await request(app).get(`/api/v1/games/${karpat_game_id}/win_chance`);

    expect(response.status).toBe(409);
    expect(error_of(response.body).code).toBe("GAME_NOT_STARTED");
  });

  it("GET /standings/odds returns every team's playoff and relegation chance", async () => {
    const response = await request(app).get("/api/v1/standings/odds");

    expect(response.status).toBe(200);
    const { data } = season_odds_response_schema.parse(response.body);
    expect(data).toMatchObject({ season: "2026-27", simulations: 500 });
    // The fixture season has 8 teams: all make the top 12, 3 are relegated.
    expect(data.rows).toHaveLength(8);
    const total = (field: "playoff_probability" | "relegation_probability") =>
      data.rows.reduce((sum, row) => sum + row[field], 0);
    expect(total("playoff_probability")).toBeCloseTo(8, 6);
    expect(total("relegation_probability")).toBeCloseTo(3, 6);
  });

  it("skips a second run with the same inputs", async () => {
    const before = await db.selectFrom("model_runs").select("id").execute();
    await run_model();
    const after = await db.selectFrom("model_runs").select("id").execute();

    expect(after).toHaveLength(before.length);
  });
});

describe("demo replay with the same model", () => {
  let source_id = "";

  beforeAll(async () => {
    const day = game_day_response_schema.parse(
      (await request(app).get("/api/v1/demo/game_day?moment=final")).body,
    ).data;
    source_id = day.games.find((game) => game.featured)?.id ?? "";
  });

  it("before: the real pre-game pick, never cached", async () => {
    const response = await request(app).get(
      `/api/v1/demo/games/${source_id}/ai_prediction?moment=before`,
    );

    expect(response.status).toBe(200);
    const { data } = ai_prediction_response_schema.parse(response.body);
    expect(data.game_id).toBe(source_id);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("live: the win chance up to the replay moment, ending with now", async () => {
    const response = await request(app).get(
      `/api/v1/demo/games/${source_id}/win_chance?moment=live`,
    );

    const { data } = win_chance_response_schema.parse(response.body);
    expect(data.state).toBe("live");
    expect(data.points[0]?.kind).toBe("start");
    expect(data.points.at(-1)?.kind).toBe("now");
  });

  it("final: the full timeline ends at the result", async () => {
    const { data } = win_chance_response_schema.parse(
      (await request(app).get(`/api/v1/demo/games/${source_id}/win_chance?moment=final`)).body,
    );

    expect(data.points.at(-1)).toMatchObject({ kind: "end" });
    expect([0, 1]).toContain(data.points.at(-1)?.home_win_probability);
  });

  it("before: no win chance yet", async () => {
    const response = await request(app).get(
      `/api/v1/demo/games/${source_id}/win_chance?moment=before`,
    );

    expect(error_of(response.body).code).toBe("GAME_NOT_STARTED");
  });
});
