import express from "express";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "./app_error";
import { create_error_middleware } from "./error_middleware";

function create_app_that_throws(error: unknown) {
  const app = express();
  app.use(express.json());
  app.post("/fail", () => {
    throw error;
  });
  app.use(create_error_middleware(pino({ level: "silent" })));
  return app;
}

describe("error_middleware", () => {
  it("formats an AppError with its code and status", async () => {
    const app = create_app_that_throws(new AppError("GAME_NOT_FOUND", 404, "Game not found"));

    const response = await request(app).post("/fail");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "GAME_NOT_FOUND", message: "Game not found" } });
  });

  it("returns 400 VALIDATION_ERROR for a zod error", async () => {
    const zod_error = z.object({ game_id: z.string() }).safeParse({}).error;
    const app = create_app_that_throws(zod_error);

    const response = await request(app).post("/fail");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toContain("game_id");
  });

  it("returns 500 INTERNAL_ERROR for an unknown error without leaking details", async () => {
    const app = create_app_that_throws(new Error("database password is hunter2"));

    const response = await request(app).post("/fail");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(response.text).not.toContain("hunter2");
  });

  it("returns 400 INVALID_JSON for a malformed body", async () => {
    const app = create_app_that_throws(new Error("not reached"));

    const response = await request(app)
      .post("/fail")
      .set("Content-Type", "application/json")
      .send("{ broken");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });
});
