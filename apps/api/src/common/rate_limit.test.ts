import express from "express";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { create_error_middleware } from "./error_middleware";
import { create_rate_limit } from "./rate_limit";

function create_limited_app(clock: () => Date) {
  const app = express();
  app.post("/", create_rate_limit({ max_requests: 2, window_ms: 60_000, clock }), (_req, res) => {
    res.status(204).end();
  });
  app.use(create_error_middleware(pino({ level: "silent" })));
  return app;
}

describe("create_rate_limit", () => {
  it("allows max_requests per window, then 429 RATE_LIMITED until the window ends", async () => {
    let now = new Date("2026-10-24T12:00:00Z");
    const app = create_limited_app(() => now);

    expect((await request(app).post("/")).status).toBe(204);
    expect((await request(app).post("/")).status).toBe(204);
    const limited = await request(app).post("/");
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ error: { code: "RATE_LIMITED" } });

    now = new Date("2026-10-24T12:01:00Z");
    expect((await request(app).post("/")).status).toBe(204);
  });
});
