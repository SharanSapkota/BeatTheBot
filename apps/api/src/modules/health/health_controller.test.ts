import { health_response_schema } from "@voita_kone/shared_types";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { create_test_app } from "../../test_helpers/create_test_app";

describe("GET /api/v1/health", () => {
  it("returns 200 with a valid health response", async () => {
    const response = await request(create_test_app()).get("/api/v1/health");

    expect(response.status).toBe(200);
    const body = health_response_schema.parse(response.body);
    expect(body.data.status).toBe("ok");
    expect(response.headers["x-request-id"]).toBeDefined();
  });
});
