import request from "supertest";
import { describe, expect, it } from "vitest";
import { create_test_app } from "../test_helpers/create_test_app";

describe("not_found_middleware", () => {
  it("returns 404 NOT_FOUND for an unknown route", async () => {
    const response = await request(create_test_app()).get("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found: GET /api/v1/does-not-exist" },
    });
  });
});
