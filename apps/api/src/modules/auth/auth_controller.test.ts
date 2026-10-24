import {
  api_error_schema,
  auth_result_response_schema,
  user_summary_response_schema,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_app } from "../../test_helpers/create_test_app";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({ db });

function error_code(body: unknown): string {
  return api_error_schema.parse(body).error.code;
}

async function sign_in(display_name: string): Promise<string> {
  const response = await request(app).post("/api/v1/auth/device").send({ display_name });
  return auth_result_response_schema.parse(response.body).data.token;
}

beforeAll(async () => {
  await reset_test_database(db);
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("POST /api/v1/auth/device", () => {
  it("creates a player with a device identity and returns a token (201)", async () => {
    const response = await request(app)
      .post("/api/v1/auth/device")
      .send({ display_name: "  Mika  " });

    expect(response.status).toBe(201);
    const { data } = auth_result_response_schema.parse(response.body);
    expect(data.user).toMatchObject({ display_name: "Mika", role: "player" });
    const identity = await db
      .selectFrom("auth_identities")
      .select(["provider"])
      .where("user_id", "=", data.user.id)
      .executeTakeFirstOrThrow();
    expect(identity.provider).toBe("device");
    const stored = await db
      .selectFrom("sessions")
      .select("token_hash")
      .where("user_id", "=", data.user.id)
      .executeTakeFirstOrThrow();
    expect(stored.token_hash).not.toBe(data.token);
  });

  it("returns 400 VALIDATION_ERROR for an empty or too long name", async () => {
    const empty = await request(app).post("/api/v1/auth/device").send({ display_name: "   " });
    const too_long = await request(app)
      .post("/api/v1/auth/device")
      .send({ display_name: "x".repeat(31) });

    expect(empty.status).toBe(400);
    expect(error_code(empty.body)).toBe("VALIDATION_ERROR");
    expect(too_long.status).toBe(400);
  });
});

describe("/api/v1/me", () => {
  it("returns the signed-in user with 0 points, never cached", async () => {
    const token = await sign_in("Sanna");

    const response = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(user_summary_response_schema.parse(response.body).data).toMatchObject({
      display_name: "Sanna",
      role: "player",
      total_points: 0,
    });
  });

  it("returns 401 UNAUTHORIZED without a token or with a bad one", async () => {
    const anonymous = await request(app).get("/api/v1/me");
    const bad = await request(app).get("/api/v1/me").set("Authorization", "Bearer nope");
    const not_bearer = await request(app).get("/api/v1/me").set("Authorization", "Basic abc");

    expect(anonymous.status).toBe(401);
    expect(error_code(anonymous.body)).toBe("UNAUTHORIZED");
    expect(bad.status).toBe(401);
    expect(not_bearer.status).toBe(401);
  });

  it("renames the user with PATCH", async () => {
    const token = await sign_in("Old name");

    const response = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ display_name: "TappaJani" });

    expect(response.status).toBe(200);
    expect(user_summary_response_schema.parse(response.body).data.display_name).toBe("TappaJani");
  });

  it("deletes the user and all their data with DELETE (the token stops working)", async () => {
    const token = await sign_in("Leaving");
    const me = user_summary_response_schema.parse(
      (await request(app).get("/api/v1/me").set("Authorization", `Bearer ${token}`)).body,
    ).data;

    const response = await request(app)
      .delete("/api/v1/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    const after = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);
    const identities = await db
      .selectFrom("auth_identities")
      .select("id")
      .where("user_id", "=", me.id)
      .execute();
    expect(identities).toHaveLength(0);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("revokes the session, so the token returns 401 afterwards", async () => {
    const token = await sign_in("Logout");

    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    const after = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);
  });
});
