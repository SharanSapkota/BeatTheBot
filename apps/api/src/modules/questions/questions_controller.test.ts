import {
  answer_result_response_schema,
  api_error_schema,
  auth_result_response_schema,
  leaderboard_response_schema,
  questions_response_schema,
  type Question,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScoreAnswersJob } from "../../jobs/score_answers";
import { KyselyScoreAnswersRepository } from "../../jobs/score_answers_repository";
import { create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { pino } from "pino";

const db = create_test_database();
const app = create_test_app({ db });

let final_game_id: string;
let live_game_id: string;

function error_code(body: unknown): string {
  return api_error_schema.parse(body).error.code;
}

async function sign_in(display_name: string): Promise<string> {
  const response = await request(app).post("/api/v1/auth/device").send({ display_name });
  return `Bearer ${auth_result_response_schema.parse(response.body).data.token}`;
}

async function list(game_id: string, phase: string, token?: string): Promise<Question[]> {
  const call = request(app).get(`/api/v1/games/${game_id}/questions?phase=${phase}`);
  const response = await (token ? call.set("Authorization", token) : call);
  expect(response.status).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  return questions_response_schema.parse(response.body).data;
}

function answer(question_id: string, value: string, token?: string) {
  const call = request(app)
    .post(`/api/v1/questions/${question_id}/answers`)
    .send({ answer: value });
  return token ? call.set("Authorization", token) : call;
}

beforeAll(async () => {
  await seed_fixture_database(db);
  const final_game = await db
    .selectFrom("games")
    .select("id")
    .where("status", "=", "final")
    .where("data_source", "=", "liiga_api")
    .where((eb) =>
      eb.exists(
        eb.selectFrom("game_events").select("id").whereRef("game_events.game_id", "=", "games.id"),
      ),
    )
    .orderBy("start_time", "desc")
    .limit(1)
    .executeTakeFirstOrThrow();
  final_game_id = final_game.id;
  const live_game = await db
    .selectFrom("games")
    .select("id")
    .where("status", "=", "live")
    .limit(1)
    .executeTakeFirstOrThrow();
  live_game_id = live_game.id;
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("GET /games/:game_id/questions", () => {
  it("lists the result quiz and the player vote of a final game, without the answers", async () => {
    const questions = await list(final_game_id, "after");
    const types = questions.map((question) => question.question_type);
    expect(types.filter((type) => type === "result_quiz").length).toBeGreaterThanOrEqual(2);
    expect(types).toContain("player_vote");
    expect(questions.every((question) => question.correct_option === null)).toBe(true);
    // Created once: asking again returns the same ids.
    expect((await list(final_game_id, "after")).map((question) => question.id)).toEqual(
      questions.map((question) => question.id),
    );
  });

  it("lists the live picks of a live game", async () => {
    const types = (await list(live_game_id, "live")).map((question) => question.question_type);
    expect(types).toEqual(expect.arrayContaining(["next_goal", "period_goal"]));
  });

  it("answers 400 for a bad phase and 404 for a malformed game id", async () => {
    expect(
      (await request(app).get(`/api/v1/games/${final_game_id}/questions?phase=x`)).status,
    ).toBe(400);
    const response = await request(app).get("/api/v1/games/nope/questions?phase=live");
    expect(error_code(response.body)).toBe("GAME_NOT_FOUND");
  });
});

describe("POST /questions/:question_id/answers", () => {
  it("needs a signed-in user", async () => {
    const [question] = await list(final_game_id, "after");
    const response = await answer(question?.id ?? "", "a");
    expect(response.status).toBe(401);
  });

  it("scores a quiz answer, refuses a second one and counts it on the leaderboard", async () => {
    const token = await sign_in("Quiz fan");
    const [question] = await list(final_game_id, "after", token);
    if (!question) {
      throw new Error("no quiz question");
    }

    const response = await answer(question.id, "a", token);
    expect(response.status).toBe(201);
    const result = answer_result_response_schema.parse(response.body).data;
    expect(result.points_awarded).toBe(result.correct ? 2 : 0);
    expect(result.explanation).not.toBeNull();

    const again = await answer(question.id, "b", token);
    expect(again.status).toBe(409);
    expect(error_code(again.body)).toBe("ALREADY_ANSWERED");

    const vote = (await list(final_game_id, "after", token)).find(
      (candidate) => candidate.question_type === "player_vote",
    );
    await answer(vote?.id ?? "", vote?.options[0]?.id ?? "", token).expect(201);

    const board = await request(app)
      .get("/api/v1/leaderboard?period=season")
      .set("Authorization", token);
    const me = leaderboard_response_schema
      .parse(board.body)
      .data.rows.find((row) => row.kind === "you");
    expect(me?.points).toBe((result.points_awarded ?? 0) + 1);
  });

  it("refuses an option that is not offered, and an unknown question", async () => {
    const token = await sign_in("Typo fan");
    const [question] = await list(final_game_id, "after", token);
    const invalid = await answer(question?.id ?? "", "z", token);
    expect(error_code(invalid.body)).toBe("INVALID_ANSWER");
    const unknown = await answer("00000000-0000-4000-8000-000000000000", "a", token);
    expect(unknown.status).toBe(404);
  });

  it("keeps a live pick open until the job decides it", async () => {
    const token = await sign_in("Live fan");
    const next_goal = (await list(live_game_id, "live", token)).find(
      (question) => question.question_type === "next_goal",
    );
    const response = await answer(next_goal?.id ?? "", "home", token);
    expect(answer_result_response_schema.parse(response.body).data.points_awarded).toBeNull();

    // Nothing is decided yet in the fixture's live game; running twice changes nothing.
    const job = new ScoreAnswersJob(
      new KyselyScoreAnswersRepository(db),
      pino({ level: "silent" }),
    );
    const first = await job.run();
    expect(await job.run()).toEqual({ closed_question_count: 0, scored_answer_count: 0 });
    expect(first.closed_question_count).toBe(0);
  });
});

describe("GET /demo/games/:game_id/questions", () => {
  it("builds the replay's questions with the answers and saves nothing", async () => {
    const before = await db
      .selectFrom("questions")
      .select(db.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();
    const response = await request(app).get(
      `/api/v1/demo/games/${final_game_id}/questions?phase=after&moment=final`,
    );
    expect(response.status).toBe(200);
    const questions = questions_response_schema.parse(response.body).data;
    expect(questions[0]?.id.startsWith("demo_")).toBe(true);
    expect(questions[0]?.correct_option).not.toBeNull();
    const after = await db
      .selectFrom("questions")
      .select(db.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();
    expect(after.count).toEqual(before.count);
  });
});
