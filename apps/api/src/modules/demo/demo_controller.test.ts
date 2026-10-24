import {
  api_error_schema,
  game_day_response_schema,
  game_detail_response_schema,
  type GameDetail,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_NOW, create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({ db });

function goals_shown(detail: GameDetail, team_id: string): number {
  return detail.events.filter((event) => event.event_type === "goal" && event.team_id === team_id)
    .length;
}

beforeAll(async () => {
  await seed_fixture_database(db);
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("GET /api/v1/demo/game_day", () => {
  it("replays the latest real Kärpät game as today's game, for every moment", async () => {
    const expected_state = { before: "upcoming", live: "live", final: "final" } as const;

    for (const moment of ["before", "live", "final"] as const) {
      const response = await request(app).get(`/api/v1/demo/game_day?moment=${moment}`);

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      const { data } = game_day_response_schema.parse(response.body);
      expect(data).toMatchObject({ date: "2026-10-24", demo_replay: true });
      expect(data.games).toHaveLength(1);
      expect(data.games[0]).toMatchObject({
        state: expected_state[moment],
        featured: true,
        data_source: "liiga_api",
      });
    }
  });

  it("places the replayed game around now", async () => {
    const before = await request(app).get("/api/v1/demo/game_day?moment=before");
    const start = new Date(
      game_day_response_schema.parse(before.body).data.games[0]?.start_time ?? 0,
    );

    expect(start.getTime()).toBeGreaterThan(TEST_NOW.getTime());
  });

  it("returns 400 without a valid moment", async () => {
    const response = await request(app).get("/api/v1/demo/game_day?moment=halftime");

    expect(response.status).toBe(400);
    expect(api_error_schema.parse(response.body).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/v1/demo/games/:game_id", () => {
  it("shows only events up to the live moment, with a matching score", async () => {
    const day = game_day_response_schema.parse(
      (await request(app).get("/api/v1/demo/game_day?moment=live")).body,
    );
    const game_id = day.data.games[0]?.id ?? "";

    const live = game_detail_response_schema.parse(
      (await request(app).get(`/api/v1/demo/games/${game_id}?moment=live`)).body,
    ).data;
    const final = game_detail_response_schema.parse(
      (await request(app).get(`/api/v1/demo/games/${game_id}?moment=final`)).body,
    ).data;

    expect(live.demo_replay).toBe(true);
    expect(live.home_goals).toBe(goals_shown(live, live.home_team.id));
    expect(live.away_goals).toBe(goals_shown(live, live.away_team.id));
    expect(live.events.length).toBeLessThan(final.events.length);
    expect(final).toMatchObject({ home_goals: 5, away_goals: 2 });
  });

  it("returns 404 for a game that is not finished", async () => {
    const day = game_day_response_schema.parse(
      (await request(app).get("/api/v1/game_days/today")).body,
    );
    const upcoming = day.data.games.find((game) => game.state === "upcoming");

    const response = await request(app).get(`/api/v1/demo/games/${upcoming?.id ?? ""}?moment=live`);

    expect(response.status).toBe(404);
    expect(api_error_schema.parse(response.body).error.code).toBe("GAME_NOT_FOUND");
  });
});

describe("demo replay disabled", () => {
  it("does not mount the /demo routes", async () => {
    const disabled_app = create_test_app({ db, config: { demo_replay_enabled: false } });

    const response = await request(disabled_app).get("/api/v1/demo/game_day?moment=live");

    expect(response.status).toBe(404);
  });
});
