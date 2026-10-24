import {
  api_error_schema,
  players_response_schema,
  teams_response_schema,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KARPAT_EXTERNAL_ID, create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({ db });

beforeAll(async () => {
  await seed_fixture_database(db);
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("GET /api/v1/teams", () => {
  it("lists all teams", async () => {
    const response = await request(app).get("/api/v1/teams");

    expect(response.status).toBe(200);
    const { data } = teams_response_schema.parse(response.body);
    expect(data).toHaveLength(17);
    expect(data.at(-1)?.name).toBe("Ässät");
    expect(data.find((team) => team.external_id === KARPAT_EXTERNAL_ID)).toMatchObject({
      name: "Kärpät",
      city: "Oulu",
    });
  });
});

describe("GET /api/v1/teams/:team_id/players", () => {
  it("returns the roster sorted by position then jersey, with goal counts", async () => {
    const teams = teams_response_schema.parse((await request(app).get("/api/v1/teams")).body);
    const karpat = teams.data.find((team) => team.external_id === KARPAT_EXTERNAL_ID);

    const response = await request(app).get(`/api/v1/teams/${karpat?.id ?? ""}/players`);

    expect(response.status).toBe(200);
    const { data } = players_response_schema.parse(response.body);
    const positions = data.map((player) => player.position);
    expect(positions.indexOf("goalie")).toBeLessThan(positions.indexOf("defense"));
    expect(positions.indexOf("defense")).toBeLessThan(positions.indexOf("forward"));
    expect(data.some((player) => player.season_goals > 0)).toBe(true);
  });

  it("returns 404 TEAM_NOT_FOUND for an unknown or malformed id", async () => {
    const unknown = await request(app).get(
      "/api/v1/teams/00000000-0000-4000-8000-000000000000/players",
    );
    const malformed = await request(app).get("/api/v1/teams/karpat/players");

    expect(unknown.status).toBe(404);
    expect(api_error_schema.parse(unknown.body).error.code).toBe("TEAM_NOT_FOUND");
    expect(malformed.status).toBe(404);
  });
});
