import {
  admin_election_response_schema,
  api_error_schema,
  auth_result_response_schema,
  election_detail_response_schema,
  election_leaderboard_response_schema,
  election_list_response_schema,
  election_results_response_schema,
  type AdminElection,
  type AdminElectionInput,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_NOW, create_test_app } from "../../test_helpers/create_test_app";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({ db });
/** Two days later: the test election's poll has closed. */
const later_app = create_test_app({ db, now: new Date("2026-10-26T12:00:00.000Z") });

// Fictional names only (never real politicians).
const ELECTION: AdminElectionInput = {
  title: "Test election",
  election_type: "municipal",
  area_type: "municipality",
  area_name: "Testila",
  election_date: "2026-11-14",
  poll_opens_at: "2026-10-20T00:00:00.000Z",
  poll_closes_at: "2026-10-25T12:00:00.000Z",
  question_text: "",
};
const CANDIDATES = ["Aino Esimerkki", "Veikko Testinen", "Liisa Kuvitelma", "Pekka Mallinen"];

let admin: string;
let editor: string;
let user: string;
let other_user: string;
let user_id: string;

function error_code(body: unknown): string {
  return api_error_schema.parse(body).error.code;
}

async function sign_in(display_name: string): Promise<{ header: string; id: string }> {
  const response = await request(app).post("/api/v1/auth/device").send({ display_name });
  const { data } = auth_result_response_schema.parse(response.body);
  return { header: `Bearer ${data.token}`, id: data.user.id };
}

async function set_role(id: string, role: "admin" | "editor"): Promise<void> {
  await db.updateTable("users").set({ role }).where("id", "=", id).execute();
}

/** Creates an election as admin with the given candidates, optionally published. */
async function create_election(
  change: Partial<AdminElectionInput> = {},
  candidate_names: readonly string[] = CANDIDATES,
  publish = true,
): Promise<AdminElection> {
  const created = await request(app)
    .post("/api/v1/admin/elections")
    .set("Authorization", admin)
    .send({ ...ELECTION, ...change });
  expect(created.status).toBe(201);
  let election = admin_election_response_schema.parse(created.body).data;
  for (const [index, full_name] of candidate_names.entries()) {
    const added = await request(app)
      .post(`/api/v1/admin/elections/${election.id}/candidates`)
      .set("Authorization", admin)
      .send({ full_name, candidate_number: index + 1, short_bio: "Fictional test candidate." });
    expect(added.status).toBe(201);
    election = admin_election_response_schema.parse(added.body).data;
  }
  if (publish) {
    const published = await request(app)
      .post(`/api/v1/admin/elections/${election.id}/publish`)
      .set("Authorization", admin);
    expect(published.status).toBe(200);
    election = admin_election_response_schema.parse(published.body).data;
  }
  return election;
}

/** Adds picks from fake users straight into the database (to reach the 20-pick rule). */
async function add_db_picks(election: AdminElection, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const { id } = await db
      .insertInto("users")
      .values({ display_name: `Fake fan ${String(index)}` })
      .returning("id")
      .executeTakeFirstOrThrow();
    const candidate = election.candidates[index % election.candidates.length];
    await db
      .insertInto("election_picks")
      .values({ user_id: id, election_id: election.id, candidate_id: candidate?.id ?? "" })
      .execute();
  }
}

beforeAll(async () => {
  await reset_test_database(db);
  const admin_session = await sign_in("Admin");
  await set_role(admin_session.id, "admin");
  admin = admin_session.header;
  const editor_session = await sign_in("Editor");
  await set_role(editor_session.id, "editor");
  editor = editor_session.header;
  const user_session = await sign_in("Fan");
  user = user_session.header;
  user_id = user_session.id;
  other_user = (await sign_in("Other fan")).header;
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("admin routes", () => {
  it("are 401 without a token and 403 for users and editors", async () => {
    const paths = [
      ["get", "/api/v1/admin/elections"],
      ["post", "/api/v1/admin/elections"],
      ["post", "/api/v1/admin/elections/00000000-0000-4000-8000-000000000000/publish"],
      ["post", "/api/v1/admin/elections/00000000-0000-4000-8000-000000000000/result"],
    ] as const;
    for (const [method, path] of paths) {
      expect((await request(app)[method](path)).status, path).toBe(401);
      for (const header of [user, editor]) {
        const response = await request(app)[method](path).set("Authorization", header).send({});
        expect(response.status, path).toBe(403);
        expect(error_code(response.body)).toBe("FORBIDDEN");
      }
    }
  });

  it("creates a draft with the default question and writes the audit log", async () => {
    const election = await create_election({}, ["Aino Esimerkki", "Veikko Testinen"], false);
    expect(election).toMatchObject({
      status: "draft",
      question_text: "Who will get the most votes in Testila?",
      candidate_count: 2,
    });
    const actions = await db
      .selectFrom("audit_log")
      .select("action")
      .where("details", "@>", JSON.stringify({ election_id: election.id }))
      .execute();
    expect(actions.map((row) => row.action)).toEqual(["candidate.create", "candidate.create"]);
    const created = await db
      .selectFrom("audit_log")
      .select(["action", "actor_user_id"])
      .where("target_id", "=", election.id)
      .execute();
    expect(created).toEqual([{ action: "election.create", actor_user_id: expect.any(String) }]);
  });

  it("needs at least 2 candidates to publish", async () => {
    const election = await create_election({}, ["Aino Esimerkki"], false);
    const response = await request(app)
      .post(`/api/v1/admin/elections/${election.id}/publish`)
      .set("Authorization", admin);
    expect(response.status).toBe(409);
    expect(error_code(response.body)).toBe("TOO_FEW_CANDIDATES");
  });

  it("rejects a poll that closes after voting close, a long bio and a non-https photo", async () => {
    const late = await request(app)
      .post("/api/v1/admin/elections")
      .set("Authorization", admin)
      .send({ ...ELECTION, poll_closes_at: "2026-11-14T19:00:00.000Z" });
    expect(late.status).toBe(400);
    expect(error_code(late.body)).toBe("VALIDATION_ERROR");

    const election = await create_election({}, [], false);
    for (const candidate of [
      { full_name: "Aino Esimerkki", short_bio: "x".repeat(201) },
      { full_name: "Aino Esimerkki", photo_url: "http://example.com/aino.jpg" },
    ]) {
      const response = await request(app)
        .post(`/api/v1/admin/elections/${election.id}/candidates`)
        .set("Authorization", admin)
        .send(candidate);
      expect(response.status).toBe(400);
    }
  });

  it("removes candidates only from drafts", async () => {
    const election = await create_election();
    const candidate_id = election.candidates[0]?.id ?? "";
    const response = await request(app)
      .delete(`/api/v1/admin/elections/${election.id}/candidates/${candidate_id}`)
      .set("Authorization", admin);
    expect(response.status).toBe(409);
    expect(error_code(response.body)).toBe("ELECTION_LOCKED");
  });
});

describe("elections for users", () => {
  it("lists published elections only, with the areas for the filter chips", async () => {
    const draft = await create_election({ area_name: "Draftila" }, CANDIDATES, false);
    const published = await create_election({ area_name: "Kuvitela" });
    const response = await request(app).get("/api/v1/elections");
    const { data } = election_list_response_schema.parse(response.body);
    const ids = data.elections.map((election) => election.id);
    expect(ids).toContain(published.id);
    expect(ids).not.toContain(draft.id);
    expect(data.areas).toContain("Kuvitela");
    expect(data.areas).not.toContain("Draftila");

    const filtered = await request(app).get("/api/v1/elections?area=Kuvitela");
    expect(
      election_list_response_schema
        .parse(filtered.body)
        .data.elections.every((election) => election.area_name === "Kuvitela"),
    ).toBe(true);
    expect((await request(app).get(`/api/v1/elections/${draft.id}`)).status).toBe(404);
  });

  it("shows a user the same candidate order every time", async () => {
    const election = await create_election();
    const order = async () => {
      const response = await request(app)
        .get(`/api/v1/elections/${election.id}`)
        .set("Authorization", user);
      return election_detail_response_schema
        .parse(response.body)
        .data.candidates.map((candidate) => candidate.id);
    };
    const first = await order();
    expect(await order()).toEqual(first);
    expect([...first].sort()).toEqual(election.candidates.map((candidate) => candidate.id).sort());
  });
});

describe("picks", () => {
  it("needs a token, then saves and changes the pick until the poll closes", async () => {
    const election = await create_election();
    const [first, second] = election.candidates;
    const path = `/api/v1/elections/${election.id}/picks`;

    expect((await request(app).post(path).send({ candidate_id: first?.id })).status).toBe(401);
    const created = await request(app)
      .post(path)
      .set("Authorization", user)
      .send({ candidate_id: first?.id });
    expect(created.status).toBe(201);
    const again = await request(app)
      .post(path)
      .set("Authorization", user)
      .send({ candidate_id: first?.id });
    expect(error_code(again.body)).toBe("PICK_EXISTS");
    const changed = await request(app)
      .put(path)
      .set("Authorization", user)
      .send({ candidate_id: second?.id });
    expect(changed.status).toBe(200);

    const detail = await request(app)
      .get(`/api/v1/elections/${election.id}`)
      .set("Authorization", user);
    expect(election_detail_response_schema.parse(detail.body).data.my_pick).toEqual({
      candidate_id: second?.id,
      points_awarded: null,
    });
  });

  it("rejects a candidate of another election", async () => {
    const election = await create_election();
    const other = await create_election();
    const response = await request(app)
      .post(`/api/v1/elections/${election.id}/picks`)
      .set("Authorization", user)
      .send({ candidate_id: other.candidates[0]?.id });
    expect(response.status).toBe(400);
    expect(error_code(response.body)).toBe("INVALID_CANDIDATE");
  });

  it("locks at poll_closes_at (server clock): 409 POLL_CLOSED", async () => {
    const election = await create_election();
    const candidate_id = election.candidates[0]?.id;
    const path = `/api/v1/elections/${election.id}/picks`;
    await request(app).post(path).set("Authorization", user).send({ candidate_id });

    for (const method of ["post", "put"] as const) {
      const response = await request(later_app)
        [method](path)
        .set("Authorization", method === "post" ? other_user : user)
        .send({ candidate_id });
      expect(response.status).toBe(409);
      expect(error_code(response.body)).toBe("POLL_CLOSED");
    }
  });
});

describe("results", () => {
  it("are hidden before the user's pick and before 20 picks", async () => {
    const election = await create_election();
    const path = `/api/v1/elections/${election.id}/results`;
    const results = async (header?: string) => {
      const call = request(app).get(path);
      const response = await (header ? call.set("Authorization", header) : call);
      return election_results_response_schema.parse(response.body).data;
    };

    await add_db_picks(election, 18);
    expect(await results(user)).toMatchObject({ hidden_reason: "pick_first", shares: null });

    await request(app)
      .post(`/api/v1/elections/${election.id}/picks`)
      .set("Authorization", user)
      .send({ candidate_id: election.candidates[0]?.id });
    expect(await results(user)).toMatchObject({
      total_picks: 19,
      hidden_reason: "not_enough_picks",
      shares: null,
      label_text: "Not a scientific poll. Shows only the picks of Voita Kaleva users.",
    });

    await add_db_picks(election, 1);
    const shown = await results(user);
    expect(shown.hidden_reason).toBeNull();
    expect(shown.shares?.reduce((sum, share) => sum + share.picks, 0)).toBe(20);
    // Still hidden for someone who has not picked while the poll is open.
    expect((await results()).hidden_reason).toBe("pick_first");

    // After the poll closed, everyone sees them.
    const closed = await request(later_app).get(path);
    expect(election_results_response_schema.parse(closed.body).data.hidden_reason).toBeNull();
  });
});

describe("entering the result", () => {
  it("needs a closed poll, then scores picks idempotently (20 / 0)", async () => {
    const election = await create_election();
    const [winner, loser] = election.candidates;
    const picks_path = `/api/v1/elections/${election.id}/picks`;
    await request(app)
      .post(picks_path)
      .set("Authorization", user)
      .send({ candidate_id: winner?.id });
    await request(app)
      .post(picks_path)
      .set("Authorization", other_user)
      .send({ candidate_id: loser?.id });

    const result_path = `/api/v1/admin/elections/${election.id}/result`;
    const body = {
      winner_candidate_id: winner?.id,
      vote_counts: { [winner?.id ?? ""]: 1200, [loser?.id ?? ""]: 900 },
    };
    const too_early = await request(app).post(result_path).set("Authorization", admin).send(body);
    expect(error_code(too_early.body)).toBe("POLL_NOT_CLOSED");

    const closed = await request(app)
      .post(`/api/v1/admin/elections/${election.id}/close`)
      .set("Authorization", admin);
    expect(admin_election_response_schema.parse(closed.body).data.status).toBe("closed");

    const points = () =>
      db
        .selectFrom("election_picks")
        .select(["candidate_id", "points_awarded"])
        .where("election_id", "=", election.id)
        .orderBy("points_awarded", "desc")
        .execute();
    for (let round = 0; round < 2; round += 1) {
      const entered = await request(app).post(result_path).set("Authorization", admin).send(body);
      expect(entered.status).toBe(200);
      expect(admin_election_response_schema.parse(entered.body).data).toMatchObject({
        status: "resulted",
        result: { winner_candidate_id: winner?.id },
      });
      expect(await points()).toEqual([
        { candidate_id: winner?.id, points_awarded: 20 },
        { candidate_id: loser?.id, points_awarded: 0 },
      ]);
    }
    const audit = await db
      .selectFrom("audit_log")
      .select("action")
      .where("target_id", "=", election.id)
      .where("action", "=", "election.result")
      .execute();
    expect(audit).toHaveLength(2);

    const board = await request(app)
      .get("/api/v1/leaderboard/elections")
      .set("Authorization", user);
    const { data } = election_leaderboard_response_schema.parse(board.body);
    expect(data.points_per_correct).toBe(20);
    expect(data.rows).toContainEqual(
      expect.objectContaining({ kind: "you", display_name: "Fan", points: 20 }),
    );
  });

  it("rejects vote counts for candidates of another election", async () => {
    const election = await create_election();
    const other = await create_election();
    await request(app)
      .post(`/api/v1/admin/elections/${election.id}/close`)
      .set("Authorization", admin);
    const response = await request(app)
      .post(`/api/v1/admin/elections/${election.id}/result`)
      .set("Authorization", admin)
      .send({
        winner_candidate_id: election.candidates[0]?.id,
        vote_counts: { [other.candidates[0]?.id ?? ""]: 10 },
      });
    expect(error_code(response.body)).toBe("INVALID_CANDIDATE");
  });
});

describe("deleting a user", () => {
  it("deletes their election picks", async () => {
    const before = await db
      .selectFrom("election_picks")
      .select("id")
      .where("user_id", "=", user_id)
      .execute();
    expect(before.length).toBeGreaterThan(0);
    expect((await request(app).delete("/api/v1/me").set("Authorization", user)).status).toBe(204);
    const after = await db
      .selectFrom("election_picks")
      .select("id")
      .where("user_id", "=", user_id)
      .execute();
    expect(after).toHaveLength(0);
  });
});

// Keeps TEST_NOW in view: the test election's poll is open at TEST_NOW.
it("uses a test clock inside the poll window", () => {
  expect(TEST_NOW >= new Date(ELECTION.poll_opens_at)).toBe(true);
  expect(TEST_NOW < new Date(ELECTION.poll_closes_at)).toBe(true);
});
