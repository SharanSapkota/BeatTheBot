import { describe, expect, it } from "vitest";
import { HealthService } from "./health_service";

describe("HealthService", () => {
  it("returns ok with the current time", () => {
    const health_service = new HealthService(() => new Date("2026-10-24T12:00:00.000Z"));

    expect(health_service.get_health()).toEqual({
      status: "ok",
      time: "2026-10-24T12:00:00.000Z",
    });
  });
});
