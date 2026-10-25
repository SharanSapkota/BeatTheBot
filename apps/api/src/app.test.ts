import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_app } from "./test_helpers/create_test_app";
import { create_test_database, reset_test_database } from "./test_helpers/test_database";

const db = create_test_database();
/** POST /auth/device allows 20 new accounts per client IP per hour. */
const SIGN_IN_LIMIT = 20;

function sign_in(app: ReturnType<typeof create_test_app>, forwarded_for: string) {
  return request(app)
    .post("/api/v1/auth/device")
    .set("X-Forwarded-For", forwarded_for)
    .send({ display_name: "Proxy fan" });
}

beforeAll(async () => {
  await reset_test_database(db);
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("behind one proxy (Render / Railway)", () => {
  it("rate limits each real client IP from X-Forwarded-For, not the proxy", async () => {
    const app = create_test_app({ db, trust_proxy_hops: 1 });
    for (let attempt = 0; attempt < SIGN_IN_LIMIT; attempt += 1) {
      expect((await sign_in(app, "203.0.113.7")).status).toBe(201);
    }

    expect((await sign_in(app, "203.0.113.7")).status).toBe(429);
    // Another fan behind the same proxy still gets in.
    expect((await sign_in(app, "198.51.100.20")).status).toBe(201);
    // A spoofed first hop does not help: the proxy appends the real IP last.
    expect((await sign_in(app, "1.2.3.4, 203.0.113.7")).status).toBe(429);
  });

  it("ignores X-Forwarded-For when no proxy is trusted", async () => {
    const app = create_test_app({ db, trust_proxy_hops: 0 });
    for (let attempt = 0; attempt < SIGN_IN_LIMIT; attempt += 1) {
      await sign_in(app, `192.0.2.${String(attempt)}`);
    }

    expect((await sign_in(app, "192.0.2.250")).status).toBe(429);
  });
});
