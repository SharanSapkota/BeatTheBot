import { describe, expect, it } from "vitest";
import { HealthService } from "./health_service";

const clock = () => new Date("2026-10-24T12:00:00.000Z");

describe("HealthService", () => {
  it("returns ok with the current time when the database answers", async () => {
    const health_service = new HealthService({ ping: () => Promise.resolve() }, clock);

    expect(await health_service.get_health()).toEqual({
      status: "ok",
      database: "ok",
      time: "2026-10-24T12:00:00.000Z",
    });
  });

  it("throws 503 DATABASE_UNAVAILABLE when the database fails", async () => {
    const health_service = new HealthService(
      { ping: () => Promise.reject(new Error("connection refused")) },
      clock,
    );

    await expect(health_service.get_health()).rejects.toMatchObject({
      code: "DATABASE_UNAVAILABLE",
      http_status: 503,
    });
  });

  it("throws 503 DATABASE_UNAVAILABLE when the database does not answer in time", async () => {
    const never_answers = { ping: () => new Promise<void>(() => undefined) };
    const health_service = new HealthService(never_answers, clock, 10);

    await expect(health_service.get_health()).rejects.toMatchObject({
      code: "DATABASE_UNAVAILABLE",
    });
  });
});
