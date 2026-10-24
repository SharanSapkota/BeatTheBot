import {
  api_error_schema,
  auth_result_response_schema,
  user_prediction_response_schema,
  user_predictions_response_schema,
  type PredictionRequest,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KARPAT_EXTERNAL_ID, create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({ db });

interface TestGame {
  id: string;
  home_team_id: string;
  away_team_id: string;
}

let upcoming: TestGame;
let started: TestGame;
let home_player_id: string;

function error_code(body: unknown): string {
  return api_error_schema.parse(body).error.code;
}

async function sign_in(display_name: string): Promise<string> {
  const response = await request(app).post("/api/v1/auth/device").send({ display_name });
  return `Bearer ${auth_result_response_schema.parse(response.body).data.token}`;
}

function pick(game: TestGame, change: Partial<PredictionRequest> = {}): PredictionRequest {
  return {
    predicted_winner_team_id: game.home_team_id,
    predicted_home_goals: 3,
    predicted_away_goals: 2,
    predicted_scorer_id: home_player_id,
    predicted_margin_band: null,
    ...change,
  };
}

beforeAll(async () => {
  await seed_fixture_database(db);
  // Today (TEST_NOW): real Kärpät - KalPa at 17:00 is upcoming; the demo live game has started.
  const karpat = await db
    .selectFrom("teams")
    .select("id")
    .where("external_id", "=", KARPAT_EXTERNAL_ID)
    .executeTakeFirstOrThrow();
  upcoming = await db
    .selectFrom("games")
    .select(["id", "home_team_id", "away_team_id"])
    .where("home_team_id", "=", karpat.id)
    .where("status", "=", "scheduled")
    .orderBy("start_time")
    .limit(1)
    .executeTakeFirstOrThrow();
  started = await db
    .selectFrom("games")
    .select(["id", "home_team_id", "away_team_id"])
    .where("status", "=", "live")
    .limit(1)
    .executeTakeFirstOrThrow();
  const player = await db
    .selectFrom("players")
    .select("id")
    .where("team_id", "=", upcoming.home_team_id)
    .limit(1)
    .executeTakeFirstOrThrow();
  home_player_id = player.id;
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("POST /api/v1/games/:game_id/predictions", () => {
  it("saves the pick (201), then 409 PREDICTION_EXISTS for a second POST", async () => {
    const auth = await sign_in("Picker");

    const response = await request(app)
      .post(`/api/v1/games/${upcoming.id}/predictions`)
      .set("Authorization", auth)
      .send(pick(upcoming));
    const again = await request(app)
      .post(`/api/v1/games/${upcoming.id}/predictions`)
      .set("Authorization", auth)
      .send(pick(upcoming));

    expect(response.status).toBe(201);
    expect(user_prediction_response_schema.parse(response.body).data).toMatchObject({
      game_id: upcoming.id,
      predicted_home_goals: 3,
      points_awarded: null,
    });
    expect(again.status).toBe(409);
    expect(error_code(again.body)).toBe("PREDICTION_EXISTS");
  });

  it("returns 401 without a token", async () => {
    const response = await request(app)
      .post(`/api/v1/games/${upcoming.id}/predictions`)
      .send(pick(upcoming));

    expect(response.status).toBe(401);
  });

  it("returns 409 PREDICTION_LOCKED for a game that has started", async () => {
    const auth = await sign_in("Late");

    const response = await request(app)
      .post(`/api/v1/games/${started.id}/predictions`)
      .set("Authorization", auth)
      .send(pick(started, { predicted_scorer_id: null }));

    expect(response.status).toBe(409);
    expect(error_code(response.body)).toBe("PREDICTION_LOCKED");
  });

  it("returns 400 for a bad body and 404 GAME_NOT_FOUND for a malformed game id", async () => {
    const auth = await sign_in("Typo");

    const bad_body = await request(app)
      .post(`/api/v1/games/${upcoming.id}/predictions`)
      .set("Authorization", auth)
      .send({ ...pick(upcoming), predicted_home_goals: -1 });
    const bad_id = await request(app)
      .post("/api/v1/games/karpat/predictions")
      .set("Authorization", auth)
      .send(pick(upcoming));

    expect(bad_body.status).toBe(400);
    expect(error_code(bad_body.body)).toBe("VALIDATION_ERROR");
    expect(bad_id.status).toBe(404);
    expect(error_code(bad_id.body)).toBe("GAME_NOT_FOUND");
  });
});

describe("PUT /api/v1/games/:game_id/predictions and GET /api/v1/me/predictions", () => {
  it("updates the pick and lists it for the user only", async () => {
    const auth = await sign_in("Changer");
    const other = await sign_in("Other");
    await request(app)
      .post(`/api/v1/games/${upcoming.id}/predictions`)
      .set("Authorization", auth)
      .send(pick(upcoming));

    const updated = await request(app)
      .put(`/api/v1/games/${upcoming.id}/predictions`)
      .set("Authorization", auth)
      .send(pick(upcoming, { predicted_winner_team_id: upcoming.away_team_id }));
    const mine = await request(app)
      .get(`/api/v1/me/predictions?game_id=${upcoming.id}`)
      .set("Authorization", auth);
    const theirs = await request(app)
      .get(`/api/v1/me/predictions?game_id=${upcoming.id}`)
      .set("Authorization", other);

    expect(updated.status).toBe(200);
    const list = user_predictions_response_schema.parse(mine.body).data;
    expect(list).toHaveLength(1);
    expect(list[0]?.predicted_winner_team_id).toBe(upcoming.away_team_id);
    expect(mine.headers["cache-control"]).toBe("no-store");
    expect(user_predictions_response_schema.parse(theirs.body).data).toEqual([]);
  });

  it("returns 404 PREDICTION_NOT_FOUND for a PUT without an earlier pick", async () => {
    const auth = await sign_in("Nothing yet");

    const response = await request(app)
      .put(`/api/v1/games/${upcoming.id}/predictions`)
      .set("Authorization", auth)
      .send(pick(upcoming));

    expect(response.status).toBe(404);
    expect(error_code(response.body)).toBe("PREDICTION_NOT_FOUND");
  });
});
