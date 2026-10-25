import { health_response_schema } from "@voita_kone/shared_types";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { create_test_app } from "../../test_helpers/create_test_app";
import { create_test_database } from "../../test_helpers/test_database";
import { create_database } from "../../db/kysely";

describe("GET /api/v1/health", () => {
  it("returns 200 when the database answers", async () => {
    const db = create_test_database();
    try {
      const response = await request(create_test_app({ db })).get("/api/v1/health");

      expect(response.status).toBe(200);
      const body = health_response_schema.parse(response.body);
      expect(body.data.database).toBe("ok");
      expect(response.headers["x-request-id"]).toBeDefined();
    } finally {
      await db.destroy();
    }
  });

  it("returns 503 DATABASE_UNAVAILABLE when the database can't be reached", async () => {
    // Port 1 refuses connections at once.
    const db = create_database("postgres://nobody:nothing@127.0.0.1:1/none");
    try {
      const response = await request(create_test_app({ db })).get("/api/v1/health");

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        error: { code: "DATABASE_UNAVAILABLE", message: "The database is not reachable." },
      });
    } finally {
      await db.destroy();
    }
  });
});
