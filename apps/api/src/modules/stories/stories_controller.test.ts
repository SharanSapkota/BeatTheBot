import {
  api_error_schema,
  auth_result_response_schema,
  editor_action_response_schema,
  editor_stories_response_schema,
  game_day_response_schema,
  game_stories_response_schema,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_NOW, create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { KyselyModelInputsRepository } from "../ai_predictions/model_inputs_repository";
import { KyselyStoriesRepository } from "./stories_repository";
import { StoryGenerationService } from "./story_generation_service";

const db = create_test_database();
const app = create_test_app({ db });
// No LLM in tests: the automatic (template) texts, with few simulations.
const generation = new StoryGenerationService(
  new KyselyStoriesRepository(db),
  new KyselyModelInputsRepository(db),
  undefined,
  () => TEST_NOW,
  { season_simulations: 200, stakes_simulations: 200 },
);

/** The demo replay's featured game: a real finished Kärpät game with goal events. */
let game_id: string;
let editor_token: string;
let player_token: string;

async function sign_in(display_name: string): Promise<{ token: string; user_id: string }> {
  const response = await request(app).post("/api/v1/auth/device").send({ display_name });
  const { data } = auth_result_response_schema.parse(response.body);
  return { token: `Bearer ${data.token}`, user_id: data.user.id };
}

async function published(type: "preview" | "summary") {
  const response = await request(app).get(`/api/v1/games/${game_id}/stories`);
  expect(response.status).toBe(200);
  return game_stories_response_schema.parse(response.body).data[type];
}

function error_code(body: unknown): string {
  return api_error_schema.parse(body).error.code;
}

beforeAll(async () => {
  await seed_fixture_database(db);
  const day = await request(app).get("/api/v1/demo/game_day?moment=final");
  game_id =
    game_day_response_schema.parse(day.body).data.games.find((game) => game.featured)?.id ?? "";
  const editor = await sign_in("Desk editor");
  await db.updateTable("users").set({ role: "editor" }).where("id", "=", editor.user_id).execute();
  editor_token = editor.token;
  player_token = (await sign_in("Just a fan")).token;
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("AI preview and AI summary", () => {
  it("says nothing before a story is published (no sample text)", async () => {
    expect(await published("summary")).toBeNull();
  });

  it("publishes the automatic summary at once as green, labelled", async () => {
    const result = await generation.generate_summary(game_id);
    expect(result).toMatchObject({ traffic_light: "green", source: "template" });

    const story = await published("summary");
    expect(story).toMatchObject({
      story_type: "summary",
      source: "template",
      label_text: "Automatic summary from Liiga data",
      correction: null,
      bullets: [],
    });
    expect(story?.body).toMatch(/^\S+ (beat|won)/);
  });

  it("publishes the preview with bullets and the last meetings from the fact sheet", async () => {
    await generation.generate_preview(game_id);

    const story = await published("preview");
    expect(story?.bullets.length).toBeGreaterThan(0);
    expect(story?.bullets.join(" ")).toContain("Data says");
    expect(story?.label_text).toBe("Automatic preview from Liiga data");
    const sheet = await db
      .selectFrom("stories")
      .innerJoin("fact_sheets", "fact_sheets.id", "stories.fact_sheet_id")
      .select("fact_sheets.kind")
      .where("stories.id", "=", story?.id ?? "")
      .executeTakeFirstOrThrow();
    expect(sheet.kind).toBe("preview");
  });

  it("demo replay: the preview before puck drop, the summary at the end", async () => {
    const before = await request(app).get(`/api/v1/demo/games/${game_id}/stories?moment=before`);
    const final = await request(app).get(`/api/v1/demo/games/${game_id}/stories?moment=final`);

    const before_data = game_stories_response_schema.parse(before.body).data;
    expect(before_data.preview?.story_type).toBe("preview");
    expect(before_data.summary).toBeNull();
    const final_data = game_stories_response_schema.parse(final.body).data;
    expect(final_data.preview).toBeNull();
    expect(final_data.summary?.story_type).toBe("summary");
  });

  it("404 for an unknown game id", async () => {
    const response = await request(app).get(`/api/v1/games/not-a-game/stories`);
    expect(response.status).toBe(404);
  });
});

describe("Report an error → editor", () => {
  let summary_id: string;

  it("a report sends the summary back to yellow: hidden until an editor decides", async () => {
    summary_id = (await published("summary"))?.id ?? "";

    const response = await request(app)
      .post(`/api/v1/stories/${summary_id}/reports`)
      .send({ reason: "The score is wrong" });

    expect(response.status).toBe(201);
    expect(await published("summary")).toBeNull();
    const audit = await db
      .selectFrom("audit_log")
      .select("action")
      .where("target_id", "=", summary_id)
      .execute();
    expect(audit.map((row) => row.action)).toContain("story.report");
  });

  it("404 for a report on an unknown story, 400 without a reason", async () => {
    const unknown = await request(app)
      .post("/api/v1/stories/00000000-0000-4000-8000-000000000000/reports")
      .send({ reason: "Wrong" });
    const empty = await request(app).post(`/api/v1/stories/${summary_id}/reports`).send({});
    expect(error_code(unknown.body)).toBe("STORY_NOT_FOUND");
    expect(empty.status).toBe(400);
  });

  it("editor routes: 401 anonymous, 403 for a normal user", async () => {
    expect((await request(app).get("/api/v1/admin/stories")).status).toBe(401);
    const forbidden = await request(app)
      .get("/api/v1/admin/stories")
      .set("Authorization", player_token);
    expect(forbidden.status).toBe(403);
    const approve = await request(app)
      .post(`/api/v1/admin/stories/${summary_id}/approve`)
      .set("Authorization", player_token);
    expect(error_code(approve.body)).toBe("FORBIDDEN");
  });

  it("the queue shows the text, each claim's status, the fact sheet and the report", async () => {
    const response = await request(app)
      .get("/api/v1/admin/stories")
      .set("Authorization", editor_token);

    const queue = editor_stories_response_schema.parse(response.body).data;
    const story = queue.find((item) => item.id === summary_id);
    expect(story).toMatchObject({
      traffic_light: "yellow",
      was_published: true,
      story_type: "summary",
    });
    expect(story?.claims.length).toBeGreaterThan(0);
    expect(story?.claims.every((claim) => claim.status === "verified")).toBe(true);
    expect(story?.facts.some((fact) => fact.type === "final_score")).toBe(true);
    expect(story?.reports).toEqual([expect.objectContaining({ reason: "The score is wrong" })]);
  });

  it("filters the queue by traffic light", async () => {
    const yellow = await request(app)
      .get("/api/v1/admin/stories?status=yellow")
      .set("Authorization", editor_token);
    const yellow_queue = editor_stories_response_schema.parse(yellow.body).data;
    expect(yellow_queue.some((item) => item.id === summary_id)).toBe(true);
    expect(yellow_queue.every((item) => item.traffic_light === "yellow")).toBe(true);

    const red = await request(app)
      .get("/api/v1/admin/stories?status=red")
      .set("Authorization", editor_token);
    expect(
      editor_stories_response_schema.parse(red.body).data.some((item) => item.id === summary_id),
    ).toBe(false);

    const bad = await request(app)
      .get("/api/v1/admin/stories?status=green")
      .set("Authorization", editor_token);
    expect(bad.status).toBe(400);
  });

  it("edit + approve runs the fact checker again: a wrong score is refused", async () => {
    const response = await request(app)
      .put(`/api/v1/admin/stories/${summary_id}`)
      .set("Authorization", editor_token)
      .send({ body: "Kärpät won 9–8 after a wild night." });

    expect(response.status).toBe(422);
    expect(error_code(response.body)).toBe("CHECK_FAILED");
  });

  it("an edited story that had been published shows a correction note with the time", async () => {
    const story = await db
      .selectFrom("stories")
      .select("body")
      .where("id", "=", summary_id)
      .executeTakeFirstOrThrow();
    const response = await request(app)
      .put(`/api/v1/admin/stories/${summary_id}`)
      .set("Authorization", editor_token)
      .send({ body: story.body, note: "The scorer list was checked" });

    expect(editor_action_response_schema.parse(response.body).data.status).toBe("corrected");
    const shown = await published("summary");
    expect(shown?.label_text).toBe("Written with AI from Liiga data · checked by Kaleva");
    expect(shown?.correction).toEqual({
      corrected_at: TEST_NOW.toISOString(),
      note: "The scorer list was checked",
    });
  });

  it("approve publishes a yellow story again; reject keeps it hidden; both are audited", async () => {
    const preview_id = (await published("preview"))?.id ?? "";
    await request(app).post(`/api/v1/stories/${preview_id}/reports`).send({ reason: "Old form" });
    expect(await published("preview")).toBeNull();

    const approve = await request(app)
      .post(`/api/v1/admin/stories/${preview_id}/approve`)
      .set("Authorization", editor_token);
    expect(editor_action_response_schema.parse(approve.body).data.status).toBe("published");
    expect((await published("preview"))?.id).toBe(preview_id);

    await request(app).post(`/api/v1/stories/${preview_id}/reports`).send({ reason: "Still old" });
    const reject = await request(app)
      .post(`/api/v1/admin/stories/${preview_id}/reject`)
      .set("Authorization", editor_token)
      .send({ note: "Wait for the refresh" });
    expect(editor_action_response_schema.parse(reject.body).data.status).toBe("rejected");
    expect(await published("preview")).toBeNull();

    const again = await request(app)
      .post(`/api/v1/admin/stories/${preview_id}/approve`)
      .set("Authorization", editor_token);
    expect(error_code(again.body)).toBe("STORY_NOT_IN_REVIEW");
    const actions = await db
      .selectFrom("audit_log")
      .select("action")
      .where("target_id", "=", preview_id)
      .execute();
    expect(actions.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "story.auto_publish",
        "story.report",
        "story.approve",
        "story.reject",
      ]),
    );
  });

  it("limits reports to 10 per IP per hour", async () => {
    const limited_app = create_test_app({ db });
    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await request(limited_app)
        .post("/api/v1/stories/00000000-0000-4000-8000-000000000000/reports")
        .send({ reason: "Spam?" });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 404)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
