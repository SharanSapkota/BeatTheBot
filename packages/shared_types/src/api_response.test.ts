import { describe, expect, it } from "vitest";
import { api_error_schema, health_response_schema } from "./api_response";

describe("health_response_schema", () => {
  it("accepts a valid health response", () => {
    const response = { data: { status: "ok", time: "2026-10-24T12:00:00.000Z" } };

    expect(health_response_schema.parse(response)).toEqual(response);
  });

  it("rejects a response without a valid time", () => {
    const response = { data: { status: "ok", time: "yesterday" } };

    expect(health_response_schema.safeParse(response).success).toBe(false);
  });
});

describe("api_error_schema", () => {
  it("accepts an error response", () => {
    const response = { error: { code: "NOT_FOUND", message: "Route not found" } };

    expect(api_error_schema.parse(response)).toEqual(response);
  });
});
