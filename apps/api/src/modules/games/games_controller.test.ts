import {
  api_error_schema,
  game_day_response_schema,
  game_detail_response_schema,
  games_response_schema,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({ db });

async function game_id_of(external_id: string): Promise<string> {
  const row = await db
    .selectFrom("games")
    .select("id")
    .where("external_id", "=", external_id)
    .executeTakeFirstOrThrow();
  return row.id;
}

function error_code(body: unknown): string {
  return api_error_schema.parse(body).error.code;
}

beforeAll(async () => {
  await seed_fixture_database(db);
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("GET /api/v1/game_days/:date", () => {
  it("returns today's games: live, then upcoming (featured), then final", async () => {
    const response = await request(app).get("/api/v1/game_days/today");

    expect(response.status).toBe(200);
    const { data } = game_day_response_schema.parse(response.body);
    expect(data.date).toBe("2026-10-24");
    expect(data.demo_replay).toBe(false);
    expect(
      data.games.map((game) => [game.state, game.featured, game.data_source, game.home_team.name]),
    ).toEqual([
      ["live", false, "demo", "KooKoo"],
      ["upcoming", true, "liiga_api", "Kärpät"],
      ["final", false, "demo", "Jukurit"],
    ]);
    expect(data.games[0]).toMatchObject({ period: 2, game_clock_seconds: 1961 });
  });

  it("is never cached while a game is live", async () => {
    const response = await request(app).get("/api/v1/game_days/2026-10-24");

    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("can be cached briefly and revalidated with the ETag otherwise", async () => {
    const first = await request(app).get("/api/v1/game_days/2026-10-23");
    const second = await request(app)
      .get("/api/v1/game_days/2026-10-23")
      .set("If-None-Match", String(first.headers.etag));

    expect(first.status).toBe(200);
    expect(first.headers["cache-control"]).toBe("public, max-age=60");
    expect(first.headers.etag).toBeDefined();
    expect(game_day_response_schema.parse(first.body).data.games).toHaveLength(1);
    expect(second.status).toBe(304);
  });

  it("returns 400 INVALID_DATE for a bad date", async () => {
    const response = await request(app).get("/api/v1/game_days/2026-02-30");

    expect(response.status).toBe(400);
    expect(error_code(response.body)).toBe("INVALID_DATE");
  });
});

describe("GET /api/v1/games", () => {
  it("lists games in a range, filtered by state", async () => {
    const response = await request(app).get(
      "/api/v1/games?from=2026-10-01&to=2026-10-31&state=final",
    );

    expect(response.status).toBe(200);
    const { data } = games_response_schema.parse(response.body);
    expect(data).toHaveLength(7);
    expect(data.every((game) => game.state === "final")).toBe(true);
  });

  it("returns 400 RANGE_TOO_LARGE for more than 31 days", async () => {
    const response = await request(app).get("/api/v1/games?from=2026-09-01&to=2026-10-31");

    expect(response.status).toBe(400);
    expect(error_code(response.body)).toBe("RANGE_TOO_LARGE");
  });

  it("returns 400 for an unknown state or a malformed team id", async () => {
    const bad_state = await request(app).get("/api/v1/games?state=paused");
    const bad_team = await request(app).get("/api/v1/games?team_id=karpat");

    expect(bad_state.status).toBe(400);
    expect(error_code(bad_state.body)).toBe("VALIDATION_ERROR");
    expect(bad_team.status).toBe(400);
  });
});

describe("GET /api/v1/games/:game_id", () => {
  it("returns a real game with events in time order and a running score", async () => {
    const response = await request(app).get(`/api/v1/games/${await game_id_of("2701405")}`);

    expect(response.status).toBe(200);
    const { data } = game_detail_response_schema.parse(response.body);
    const goals = data.events.filter((event) => event.event_type === "goal");
    const times = data.events.map((event) => event.game_time_seconds);
    expect(data).toMatchObject({ state: "final", home_goals: 5, away_goals: 2, featured: true });
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(goals.at(-1)?.score_after).toEqual({ home: 5, away: 2 });
    expect(goals[0]?.player).not.toBeNull();
    expect(data.events.filter((event) => event.event_type === "period_end")).toHaveLength(3);
    expect(response.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("returns 404 GAME_NOT_FOUND for an unknown or malformed id", async () => {
    const unknown = await request(app).get("/api/v1/games/00000000-0000-4000-8000-000000000000");
    const malformed = await request(app).get("/api/v1/games/2701405");

    expect(unknown.status).toBe(404);
    expect(error_code(unknown.body)).toBe("GAME_NOT_FOUND");
    expect(malformed.status).toBe(404);
    expect(error_code(malformed.body)).toBe("GAME_NOT_FOUND");
  });
});
