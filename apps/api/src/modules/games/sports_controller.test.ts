import {
  api_error_schema,
  game_day_response_schema,
  game_detail_response_schema,
  games_overview_response_schema,
  games_response_schema,
  sports_day_response_schema,
  teams_response_schema,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

// Sport categories (step 8): the seed has real Liiga hockey plus sample football and basketball.
const db = create_test_database();
const app = create_test_app({ db });

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

describe("GET /api/v1/sports", () => {
  it("lists every sport with today's game counts", async () => {
    const response = await request(app).get("/api/v1/sports");

    expect(response.status).toBe(200);
    const { data } = sports_day_response_schema.parse(response.body);
    expect(data.date).toBe("2026-10-24");
    expect(data.sports.map((sport) => sport.sport)).toEqual(["hockey", "football", "basketball"]);
    const count = (sport: string) => data.sports.find((row) => row.sport === sport)?.game_count;
    expect(count("hockey")).toBe(3);
    expect(count("football")).toBe(3);
    expect(count("basketball")).toBe(2);
  });

  it("rejects a bad date", async () => {
    const response = await request(app).get("/api/v1/sports?date=24.10.2026");

    expect(response.status).toBe(400);
    expect(error_code(response.body)).toBe("INVALID_DATE");
  });
});

describe("sport filter on the games endpoints", () => {
  it("keeps hockey as the default of the game day", async () => {
    const response = await request(app).get("/api/v1/game_days/today");

    const { data } = game_day_response_schema.parse(response.body);
    expect(data.games.length).toBe(3);
    expect(
      data.games.every((game) => game.sport === "hockey" && game.league.name === "Liiga"),
    ).toBe(true);
  });

  it("returns one sport's games with the league and the sample data source", async () => {
    const response = await request(app).get("/api/v1/game_days/today?sport=football");

    const { data } = game_day_response_schema.parse(response.body);
    expect(data.games).toHaveLength(3);
    expect(data.games.every((game) => game.sport === "football")).toBe(true);
    expect(data.games.every((game) => game.league.name === "Veikkausliiga")).toBe(true);
    expect(data.games.every((game) => game.data_source === "demo")).toBe(true);
    expect(data.games.every((game) => game.home_team.sport === "football")).toBe(true);
  });

  it("filters /games and /teams by sport", async () => {
    const games = games_response_schema.parse(
      (await request(app).get("/api/v1/games?from=2026-10-22&to=2026-10-27&sport=basketball")).body,
    ).data;
    const teams = teams_response_schema.parse(
      (await request(app).get("/api/v1/teams?sport=basketball")).body,
    ).data;

    expect(games).toHaveLength(7);
    expect(games.every((game) => game.sport === "basketball")).toBe(true);
    expect(teams.map((team) => team.name)).toContain("Karhu Basket");
    expect(teams.every((team) => team.sport === "basketball")).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for an unknown sport", async () => {
    const response = await request(app).get("/api/v1/game_days/today?sport=curling");

    expect(response.status).toBe(400);
    expect(error_code(response.body)).toBe("VALIDATION_ERROR");
  });

  it("shows a basketball final's top scorer and its quarter ends", async () => {
    const final = games_response_schema
      .parse(
        (
          await request(app).get(
            "/api/v1/games?from=2026-10-22&to=2026-10-24&sport=basketball&state=final",
          )
        ).body,
      )
      .data.at(0);
    const detail = game_detail_response_schema.parse(
      (await request(app).get(`/api/v1/games/${final?.id ?? ""}`)).body,
    ).data;

    expect(detail.top_scorer).not.toBeNull();
    expect(
      detail.events
        .filter((event) => event.event_type === "period_end")
        .map((event) => event.game_time_seconds),
    ).toEqual([600, 1200, 1800, 2400]);
  });
});

describe("demo replay per sport", () => {
  it("replays yesterday's sample football games live: 2nd half, goals so far", async () => {
    const response = await request(app).get("/api/v1/demo/game_day?moment=live&sport=football");

    const { data } = game_day_response_schema.parse(response.body);
    expect(data.demo_replay).toBe(true);
    expect(data.games).toHaveLength(2);
    expect(data.games.every((game) => game.state === "live" && game.period === 2)).toBe(true);
    const oulu = data.games.find((game) => game.home_team.name === "AC Oulu");
    // AC Oulu 2–1 HJK: 23' and 51' were scored by 62', the 78' winner not yet.
    expect([oulu?.home_goals, oulu?.away_goals]).toEqual([1, 1]);
  });

  it("replays basketball with a scaled score while live and the top scorer at the end", async () => {
    const live = game_day_response_schema.parse(
      (await request(app).get("/api/v1/demo/game_day?moment=live&sport=basketball")).body,
    ).data;
    const karhu = live.games.find((game) => game.home_team.name === "Karhu Basket");
    const final = game_detail_response_schema.parse(
      (await request(app).get(`/api/v1/demo/games/${karhu?.id ?? ""}?moment=final`)).body,
    ).data;

    // 3rd quarter 5:00 = 62.5% of 88–81.
    expect([karhu?.home_goals, karhu?.away_goals, karhu?.period]).toEqual([55, 51, 3]);
    expect(final).toMatchObject({ state: "final", home_goals: 88, away_goals: 81 });
    expect(final.top_scorer).not.toBeNull();
  });

  it("counts each sport's replay day for the demo tabs", async () => {
    const { data } = sports_day_response_schema.parse(
      (await request(app).get("/api/v1/demo/sports")).body,
    );

    expect(data.sports.map((sport) => [sport.sport, sport.game_count])).toEqual([
      ["hockey", expect.any(Number) as number],
      ["football", 2],
      ["basketball", 2],
    ]);
  });
});

describe("GET /api/v1/games/overview", () => {
  it("gives today's games, the latest results and the next games of a sport", async () => {
    const response = await request(app).get("/api/v1/games/overview?sport=football");

    expect(response.status).toBe(200);
    const { data } = games_overview_response_schema.parse(response.body);
    expect(data.date).toBe("2026-10-24");
    expect(data.today).toHaveLength(3);
    expect(data.latest_results?.date).toBe("2026-10-23");
    expect(data.latest_results?.games.every((game) => game.state === "final")).toBe(true);
    expect(data.coming_up?.date).toBe("2026-10-25");
    expect(data.coming_up?.games.every((game) => game.state === "upcoming")).toBe(true);
    expect(data.next_7_days_count).toBeGreaterThan(0);
  });

  it("defaults to hockey and rejects an unknown sport", async () => {
    const hockey = await request(app).get("/api/v1/games/overview");
    expect(games_overview_response_schema.parse(hockey.body).data.today[0]?.sport).toBe("hockey");
    const unknown = await request(app).get("/api/v1/games/overview?sport=curling");
    expect(unknown.status).toBe(400);
  });
});
