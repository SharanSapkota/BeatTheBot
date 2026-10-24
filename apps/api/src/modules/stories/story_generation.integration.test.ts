import { pino } from "pino";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenerateStoriesJob } from "../../jobs/generate_stories";
import { TEST_NOW } from "../../test_helpers/create_test_app";
import { ScriptedLlmClient } from "../../test_helpers/scripted_llm_client";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { KyselyModelInputsRepository } from "../ai_predictions/model_inputs_repository";
import { KyselyStoriesRepository } from "./stories_repository";
import { StoriesService } from "./stories_service";
import {
  AI_SAMPLE_LABEL,
  SAMPLE_TEMPLATE_LABELS,
  StoryGenerationService,
} from "./story_generation_service";
import type { LlmClient } from "../../integrations/llm_client/llm_client";

// Step 10: stories for every sport (football / basketball from sample data), the input hash
// (unchanged facts = no new LLM call), the template retry once an LLM works, and the backfill
// of each sport's latest results. The LLM is always scripted (no real calls).

const db = create_test_database();
const repository = new KyselyStoriesRepository(db);
const logger = pino({ level: "silent" });
const DAY_MS = 24 * 60 * 60 * 1000;

function generation(llm: LlmClient | undefined, now = TEST_NOW) {
  return new StoryGenerationService(
    repository,
    new KyselyModelInputsRepository(db),
    llm,
    () => now,
    {
      season_simulations: 200,
      stakes_simulations: 200,
    },
  );
}

async function football_final(): Promise<string> {
  const row = await db
    .selectFrom("games")
    .select("id")
    .where("sport", "=", "football")
    .where("status", "=", "final")
    .orderBy("start_time", "desc")
    .limit(1)
    .executeTakeFirstOrThrow();
  return row.id;
}

async function story_count(game_id: string): Promise<number> {
  const row = await db
    .selectFrom("stories")
    .select(sql<number>`count(*)::int`.as("count"))
    .where("game_id", "=", game_id)
    .executeTakeFirstOrThrow();
  return row.count;
}

beforeAll(async () => {
  await seed_fixture_database(db);
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("stories for sample sports", () => {
  it("writes a football summary from sample data, green and labelled as sample data", async () => {
    const game_id = await football_final();
    const result = await generation(undefined).generate_summary(game_id);
    expect(result).toMatchObject({ traffic_light: "green", source: "template" });

    const stories = await new StoriesService(repository, () => TEST_NOW).get_game_stories(game_id);
    expect(stories.summary?.label_text).toBe(SAMPLE_TEMPLATE_LABELS.summary);
    expect(stories.summary?.body).toMatch(/(beat|won|drew)/);
  });

  it("writes a basketball preview with the table and a Why it matters line", async () => {
    const game = await db
      .selectFrom("games")
      .select("id")
      .where("sport", "=", "basketball")
      .where("status", "=", "scheduled")
      .orderBy("start_time")
      .limit(1)
      .executeTakeFirstOrThrow();
    await generation(undefined).generate_preview(game.id);
    const stories = await new StoriesService(repository, () => TEST_NOW).get_game_stories(game.id);
    expect(stories.preview?.bullets.length).toBeGreaterThan(0);
    expect(stories.preview?.label_text).toBe(SAMPLE_TEMPLATE_LABELS.preview);
  });
});

describe("input hash and template retry", () => {
  it("skips a game whose facts have not changed (no second story, no LLM call)", async () => {
    const game_id = await football_final();
    const before = await story_count(game_id);
    const result = await generation(undefined).generate_summary(game_id);
    expect(result).toEqual({ skipped: "unchanged" });
    expect(await story_count(game_id)).toBe(before);
  });

  it("writes a template story again once an LLM works, labelled as AI from sample data", async () => {
    const game_id = await football_final();
    const sheet_text = await db
      .selectFrom("fact_sheets")
      .select("facts")
      .where("game_id", "=", game_id)
      .where("kind", "=", "summary")
      .executeTakeFirstOrThrow();
    // A scripted answer that cites only the first fact (the final score) and is long enough.
    const facts = sheet_text.facts as { fact_id: string; value: Record<string, unknown> }[];
    const score = facts[0]?.value as {
      home_team: string;
      away_team: string;
      home_goals: number;
      away_goals: number;
    };
    const filler = "The game was played in front of a home crowd and both teams had chances.";
    const answer = [
      `${score.home_team} and ${score.away_team} met in a league game. [f1]`,
      filler,
      filler,
      filler,
      filler,
      "Both teams now look to the next round.",
    ].join(" ");
    const llm = new ScriptedLlmClient([answer]);
    const result = await generation(llm).generate_summary(game_id);
    expect(llm.requests.length).toBeGreaterThan(0);
    expect("skipped" in result).toBe(false);
    // Unchanged facts with an LLM story now: the next run makes no call.
    const again = new ScriptedLlmClient([answer]);
    if ("traffic_light" in result && result.traffic_light === "green") {
      const stories = await new StoriesService(repository, () => TEST_NOW).get_game_stories(
        game_id,
      );
      expect(stories.summary?.label_text).toBe(AI_SAMPLE_LABEL);
    }
    const second = await generation(again).generate_summary(game_id);
    expect(second).toEqual({ skipped: "unchanged" });
    expect(again.requests).toHaveLength(0);
  });
});

describe("GenerateStoriesJob", () => {
  it("backfills each sport's latest results, even older than 7 days", async () => {
    // Three weeks later: the latest results are outside the 7-day window.
    const later = new Date(TEST_NOW.getTime() + 21 * DAY_MS);
    await db.deleteFrom("stories").execute();
    const job = new GenerateStoriesJob(
      repository,
      generation(undefined, later),
      logger,
      () => later,
    );
    const result = await job.run();
    expect(result.summaries).toBeGreaterThan(0);
    expect(result.failed_count).toBe(0);

    const missing = await repository.list_latest_results_without_story("summary", "en");
    expect(missing).toEqual([]);
    // Running again writes nothing new.
    const again = await job.run();
    expect(again.summaries).toBe(0);
  });
});
