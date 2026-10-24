import { game_day_response_schema, story_response_schema } from "@voita_kone/shared_types";
import { pino } from "pino";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenerateStoriesJob } from "../../jobs/generate_stories";
import { MockLlmClient } from "../../integrations/llm_client/mock_llm_client";
import {
  TEST_NOW,
  create_test_app,
  create_test_dependencies,
} from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { KyselyModelInputsRepository } from "../ai_predictions/model_inputs_repository";
import { KyselyStoriesRepository } from "./stories_repository";
import { StoryGenerationService } from "./story_generation_service";

const db = create_test_database();
const dependencies = create_test_dependencies({ db });
const app = create_test_app({ db });
const repository = new KyselyStoriesRepository(db);
const generation = new StoryGenerationService(
  repository,
  new KyselyModelInputsRepository(db),
  new MockLlmClient(),
  () => TEST_NOW,
  200,
);

/** The demo replay's featured game: a real finished Kärpät game with goal events. */
let game_id: string;

beforeAll(async () => {
  await seed_fixture_database(db);
  const day = await request(app).get("/api/v1/demo/game_day?moment=final");
  const featured = game_day_response_schema
    .parse(day.body)
    .data.games.find((game) => game.featured);
  game_id = featured?.id ?? "";
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("what it means: generate, review, publish", () => {
  it("writes a checked 🟡 story from the fact sheet, not visible before approval", async () => {
    const result = await generation.generate(game_id);

    expect(result).toMatchObject({ status: "created", traffic_light: "yellow" });
    const stored = await db
      .selectFrom("stories")
      .innerJoin("fact_sheets", "fact_sheets.id", "stories.fact_sheet_id")
      .select([
        "stories.status",
        "stories.headline",
        "stories.body",
        "stories.model_name",
        "fact_sheets.facts",
      ])
      .where("stories.id", "=", result.story_id)
      .executeTakeFirstOrThrow();
    expect(stored).toMatchObject({ status: "in_review", model_name: "mock_llm_v1" });
    expect(stored.body).not.toMatch(/\[f\d+\]/);
    // A real game in the season data: standings, odds and next games are in the sheet.
    expect(JSON.stringify(stored.facts)).toContain('"type":"season_odds"');

    const response = await request(app).get(`/api/v1/games/${game_id}/stories?type=what_it_means`);
    expect(response.status).toBe(200);
    expect(story_response_schema.parse(response.body).data).toBeNull();
  });

  it("publishes after the editor approves, with the label", async () => {
    const story = await db
      .selectFrom("stories")
      .select("id")
      .where("game_id", "=", game_id)
      .executeTakeFirstOrThrow();

    await dependencies.stories_service.approve(story.id);
    const response = await request(app).get(`/api/v1/games/${game_id}/stories`);

    const published = story_response_schema.parse(response.body).data;
    expect(published?.label_text).toMatch(
      /^AI-written from Liiga data\. Checked by Kaleva sports desk, \d\d:\d\d\.$/,
    );
    expect(published?.body).toContain("Kärpät");
    const review = await db
      .selectFrom("story_reviews")
      .select("decision")
      .where("story_id", "=", story.id)
      .executeTakeFirstOrThrow();
    expect(review.decision).toBe("approve");
  });

  it("shows the story in the demo replay only at the final moment", async () => {
    const live = await request(app).get(`/api/v1/demo/games/${game_id}/stories?moment=live`);
    const final = await request(app).get(`/api/v1/demo/games/${game_id}/stories?moment=final`);

    expect(story_response_schema.parse(live.body).data).toBeNull();
    expect(story_response_schema.parse(final.body).data).not.toBeNull();
    expect(final.headers["cache-control"]).toBe("no-store");
  });

  it("returns 404 GAME_NOT_FOUND for a malformed game id", async () => {
    const response = await request(app).get("/api/v1/games/karpat/stories");

    expect(response.status).toBe(404);
  });
});

describe("GenerateStoriesJob", () => {
  it("writes stories for recent finished games without one, and skips the rest", async () => {
    const job = new GenerateStoriesJob(
      repository,
      generation,
      pino({ level: "silent" }),
      () => TEST_NOW,
    );

    const first = await job.run();
    const second = await job.run();

    expect(first.failed_count).toBe(0);
    expect(first.created_count).toBeGreaterThan(0);
    expect(second.created_count).toBe(0);
  });
});
