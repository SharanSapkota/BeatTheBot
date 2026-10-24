import { api_error_schema, standings_response_schema } from "@voita_kone/shared_types";
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

describe("GET /api/v1/standings", () => {
  it("returns the latest snapshot with goal difference and form", async () => {
    const response = await request(app).get("/api/v1/standings");

    expect(response.status).toBe(200);
    const { data } = standings_response_schema.parse(response.body);
    const karpat = data.rows.find((row) => row.team.external_id === KARPAT_EXTERNAL_ID);
    expect(data.season).toBe("2026-27");
    expect(data.rows).toHaveLength(17);
    expect(karpat?.goal_difference).toBe((karpat?.goals_for ?? 0) - (karpat?.goals_against ?? 0));
    // Fixtures, newest first: 5-2 W, 1-2 SO loss, 4-3 SO win, 5-4 OT win, 1-2 OT loss.
    expect(karpat?.form).toEqual(["W", "OTL", "OTW", "OTW", "OTL"]);
    expect(response.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("accepts a season and rejects a malformed one", async () => {
    const known = await request(app).get("/api/v1/standings?season=2026-27");
    const malformed = await request(app).get("/api/v1/standings?season=2027");

    expect(standings_response_schema.parse(known.body).data.rows).toHaveLength(17);
    expect(malformed.status).toBe(400);
    expect(api_error_schema.parse(malformed.body).error.code).toBe("VALIDATION_ERROR");
  });
});
