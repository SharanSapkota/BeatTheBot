import {
  api_error_schema,
  auth_result_response_schema,
  room_answer_response_schema,
  room_current_response_schema,
  room_detail_response_schema,
  room_leaderboard_response_schema,
  room_questions_response_schema,
  room_reactions_response_schema,
  room_summaries_response_schema,
  type RoomDetail,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_NOW, create_test_app } from "../../test_helpers/create_test_app";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

const db = create_test_database();
const app = create_test_app({ db });
/** One slot (60 s) later: the first question is locked and revealed. */
const next_slot_app = create_test_app({ db, now: new Date(TEST_NOW.getTime() + 60_000) });

interface Session {
  header: string;
  id: string;
}

let owner: Session;
let fan: Session;
let outsider: Session;

function error_code(body: unknown): string {
  return api_error_schema.parse(body).error.code;
}

async function sign_in(display_name: string): Promise<Session> {
  const response = await request(app).post("/api/v1/auth/device").send({ display_name });
  const { data } = auth_result_response_schema.parse(response.body);
  return { header: `Bearer ${data.token}`, id: data.user.id };
}

async function create_room(name = "Kärpät fans"): Promise<RoomDetail> {
  const response = await request(app)
    .post("/api/v1/rooms")
    .set("Authorization", owner.header)
    .send({ name, topic: "hockey", question_interval_seconds: 60 });
  expect(response.status).toBe(201);
  return room_detail_response_schema.parse(response.body).data;
}

async function join(session: Session, key: string, target = app): Promise<request.Response> {
  return request(target)
    .post("/api/v1/rooms/join")
    .set("Authorization", session.header)
    .send({ key });
}

beforeAll(async () => {
  await reset_test_database(db);
  owner = await sign_in("Owner");
  fan = await sign_in("Fan");
  outsider = await sign_in("Outsider");
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("create, join, leave, remove", () => {
  it("needs a session", async () => {
    const response = await request(app).post("/api/v1/rooms").send({});
    expect(response.status).toBe(401);
  });

  it("validates the name and the question speed", async () => {
    const short = await request(app)
      .post("/api/v1/rooms")
      .set("Authorization", owner.header)
      .send({ name: "Ab", topic: "hockey", question_interval_seconds: 60 });
    expect(short.status).toBe(400);
    const fast = await request(app)
      .post("/api/v1/rooms")
      .set("Authorization", owner.header)
      .send({ name: "Too fast", topic: "hockey", question_interval_seconds: 10 });
    expect(error_code(fast.body)).toBe("INVALID_INTERVAL");
  });

  it("creates a room, joins with a lower-case key, lists it, leaves and is removed", async () => {
    const room = await create_room();
    expect(room.join_key).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);

    const joined = await join(fan, room.join_key.toLowerCase());
    expect(joined.status).toBe(200);
    expect(room_detail_response_schema.parse(joined.body).data.member_count).toBe(2);

    const mine = await request(app).get("/api/v1/me/rooms").set("Authorization", fan.header);
    const rooms = room_summaries_response_schema.parse(mine.body).data;
    expect(rooms.find((row) => row.id === room.id)?.my_role).toBe("member");

    const left = await request(app)
      .delete(`/api/v1/rooms/${room.id}/members/${fan.id}`)
      .set("Authorization", fan.header);
    expect(left.status).toBe(204);

    await join(fan, room.join_key);
    const removed = await request(app)
      .delete(`/api/v1/rooms/${room.id}/members/${fan.id}`)
      .set("Authorization", owner.header);
    expect(removed.status).toBe(204);

    const owner_leaves = await request(app)
      .delete(`/api/v1/rooms/${room.id}/members/${owner.id}`)
      .set("Authorization", owner.header);
    expect(error_code(owner_leaves.body)).toBe("OWNER_CANNOT_LEAVE");
  });

  it("lets the owner rename, change the speed, regenerate the key and close", async () => {
    const room = await create_room("Workplace league");
    const patched = await request(app)
      .patch(`/api/v1/rooms/${room.id}`)
      .set("Authorization", owner.header)
      .send({ name: "Office league", question_interval_seconds: 300 });
    const changed = room_detail_response_schema.parse(patched.body).data;
    expect(changed.name).toBe("Office league");
    expect(changed.question_interval_seconds).toBe(300);

    const regenerated = await request(app)
      .post(`/api/v1/rooms/${room.id}/regenerate_key`)
      .set("Authorization", owner.header);
    const new_key = room_detail_response_schema.parse(regenerated.body).data.join_key;
    expect(new_key).not.toBe(room.join_key);
    expect(error_code((await join(fan, room.join_key)).body)).toBe("ROOM_NOT_FOUND");

    const closed = await request(app)
      .post(`/api/v1/rooms/${room.id}/close`)
      .set("Authorization", owner.header);
    expect(room_detail_response_schema.parse(closed.body).data.status).toBe("closed");
    expect(error_code((await join(fan, new_key)).body)).toBe("ROOM_CLOSED");
  });

  it("stops joins when the room is full", async () => {
    const room = await create_room("Tiny room");
    await db.updateTable("rooms").set({ max_members: 2 }).where("id", "=", room.id).execute();
    expect((await join(fan, room.join_key)).status).toBe(200);
    const full = await join(outsider, room.join_key);
    expect(full.status).toBe(409);
    expect(error_code(full.body)).toBe("ROOM_FULL");
  });
});

describe("private rooms", () => {
  it("gives 403 to non-members on every room read and write", async () => {
    const room = await create_room("Secret room");
    const paths = [
      `/api/v1/rooms/${room.id}`,
      `/api/v1/rooms/${room.id}/current_question`,
      `/api/v1/rooms/${room.id}/questions`,
      `/api/v1/rooms/${room.id}/leaderboard`,
    ];
    for (const path of paths) {
      const response = await request(app).get(path).set("Authorization", outsider.header);
      expect(response.status).toBe(403);
      expect(error_code(response.body)).toBe("NOT_A_MEMBER");
    }
    const current = await request(app)
      .get(`/api/v1/rooms/${room.id}/current_question`)
      .set("Authorization", owner.header);
    const question_id = room_current_response_schema.parse(current.body).data.question?.id ?? "";
    const answer = await request(app)
      .post(`/api/v1/room_questions/${question_id}/answers`)
      .set("Authorization", outsider.header)
      .send({ option: "a" });
    expect(answer.status).toBe(403);
    const react = await request(app)
      .post(`/api/v1/room_questions/${question_id}/reactions`)
      .set("Authorization", outsider.header)
      .send({ emoji: "🔥" });
    expect(react.status).toBe(403);
  });

  it("gives 404 for an unknown or malformed room id", async () => {
    const malformed = await request(app)
      .get("/api/v1/rooms/nope")
      .set("Authorization", owner.header);
    expect(error_code(malformed.body)).toBe("ROOM_NOT_FOUND");
  });
});

describe("join rate limit", () => {
  it("allows 10 tries per IP per minute, then 429", async () => {
    const limited_app = create_test_app({ db });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await join(outsider, "ZZZZZZ", limited_app);
      expect(response.status).toBe(404);
    }
    const blocked = await join(outsider, "ZZZZZZ", limited_app);
    expect(blocked.status).toBe(429);
    expect(error_code(blocked.body)).toBe("RATE_LIMITED");
  });
});

describe("questions, answers, reactions, leaderboard", () => {
  let room: RoomDetail;
  let question_id: string;
  let correct: string;

  beforeAll(async () => {
    room = await create_room("Quiz room");
    await join(fan, room.join_key);
  });

  it("shows the current question with a countdown and no answer", async () => {
    const response = await request(app)
      .get(`/api/v1/rooms/${room.id}/current_question`)
      .set("Authorization", owner.header);
    expect(response.status).toBe(200);
    const question = room_current_response_schema.parse(response.body).data.question;
    expect(question?.seconds_left).toBe(60);
    expect(question?.member_count).toBe(2);
    expect(JSON.stringify(response.body)).not.toContain("correct_option");
    question_id = question?.id ?? "";
    const stored = await db
      .selectFrom("room_questions")
      .select(["correct_option", "question_type", "options"])
      .where("id", "=", question_id)
      .executeTakeFirstOrThrow();
    // Opinion questions have no right answer: then any option scores.
    correct = stored.correct_option ?? "a";
  });

  it("saves one answer each; a second answer is 409 ALREADY_ANSWERED", async () => {
    const first = await request(app)
      .post(`/api/v1/room_questions/${question_id}/answers`)
      .set("Authorization", fan.header)
      .send({ option: correct });
    expect(first.status).toBe(201);
    expect(room_answer_response_schema.parse(first.body).data.option).toBe(correct);
    const again = await request(app)
      .post(`/api/v1/room_questions/${question_id}/answers`)
      .set("Authorization", fan.header)
      .send({ option: correct });
    expect(again.status).toBe(409);
    expect(error_code(again.body)).toBe("ALREADY_ANSWERED");
  });

  it("locks the question in the next slot: 409 QUESTION_LOCKED", async () => {
    const late = await request(next_slot_app)
      .post(`/api/v1/room_questions/${question_id}/answers`)
      .set("Authorization", owner.header)
      .send({ option: correct });
    expect(late.status).toBe(409);
    expect(error_code(late.body)).toBe("QUESTION_LOCKED");
  });

  it("reveals the answer and the split in the next slot", async () => {
    const response = await request(next_slot_app)
      .get(`/api/v1/rooms/${room.id}/questions?limit=5`)
      .set("Authorization", owner.header);
    const [revealed] = room_questions_response_schema.parse(response.body).data;
    expect(revealed?.id).toBe(question_id);
    expect(revealed?.answer_count).toBe(1);
    expect(revealed?.split.find((row) => row.option_id === correct)?.share).toBe(1);
    expect(revealed?.my_answer).toBeNull();
  });

  it("toggles a reaction", async () => {
    const path = `/api/v1/room_questions/${question_id}/reactions`;
    const added = await request(app)
      .post(path)
      .set("Authorization", fan.header)
      .send({ emoji: "🔥" });
    const fire = room_reactions_response_schema.parse(added.body).data.reactions[0];
    expect(fire).toEqual({ emoji: "🔥", count: 1, mine: true });
    const removed = await request(app)
      .post(path)
      .set("Authorization", fan.header)
      .send({ emoji: "🔥" });
    expect(room_reactions_response_schema.parse(removed.body).data.reactions[0]?.count).toBe(0);
    const bad = await request(app)
      .post(path)
      .set("Authorization", fan.header)
      .send({ emoji: "💩" });
    expect(bad.status).toBe(400);
  });

  it("ranks the members on the room scoreboard after the reveal", async () => {
    const before = await request(app)
      .get(`/api/v1/rooms/${room.id}/leaderboard?period=all`)
      .set("Authorization", fan.header);
    expect(room_leaderboard_response_schema.parse(before.body).data.rows[0]?.points).toBe(0);

    const after = await request(next_slot_app)
      .get(`/api/v1/rooms/${room.id}/leaderboard?period=week`)
      .set("Authorization", fan.header);
    const board = room_leaderboard_response_schema.parse(after.body).data;
    expect(board.period).toBe("week");
    expect(board.rows.map((row) => [row.display_name, row.kind])).toEqual([
      ["Fan", "you"],
      ["Owner", "user"],
    ]);
    expect(board.rows[0]?.points).toBeGreaterThan(0);
    expect(board.rows[0]?.answers).toBe(1);
  });

  it("never adds room points to the global points", async () => {
    const me = await request(next_slot_app).get("/api/v1/me").set("Authorization", fan.header);
    expect((me.body as { data: { total_points: number } }).data.total_points).toBe(0);
  });
});
