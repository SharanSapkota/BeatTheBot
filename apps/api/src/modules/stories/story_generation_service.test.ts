import type { FactSheet } from "@voita_kone/fact_checker";
import { describe, expect, it } from "vitest";
import type { LlmClient, LlmRequest, LlmResponse } from "../../integrations/llm_client/llm_client";
import { MockLlmClient } from "../../integrations/llm_client/mock_llm_client";
import type { ModelInputsRepository, SeasonRows } from "../ai_predictions/model_inputs_repository";
import type { StoryGame, StoryGoalRow } from "./fact_sheet_input";
import type {
  NewStory,
  PublishedStoryRow,
  StoriesRepository,
  StoryRow,
} from "./stories_repository";
import { StoryGenerationService, write_checked_draft } from "./story_generation_service";
import { STORY_NAMES, STORY_SHEET } from "./test_story_sheet";

const NOW = new Date("2026-10-24T19:30:00.000Z");

/** Answers with the given texts in order and records the prompts. */
class ScriptedLlm implements LlmClient {
  prompts: string[] = [];

  constructor(private readonly answers: string[]) {}

  complete(request: LlmRequest): Promise<LlmResponse> {
    this.prompts.push(request.prompt);
    const text = this.answers[Math.min(this.prompts.length - 1, this.answers.length - 1)] ?? "";
    return Promise.resolve({ text, model_name: "scripted" });
  }
}

const RIGHT = "Kärpät beat Ilves 3–1 at home. [f1]";
const WRONG = "Kärpät beat Ilves 4–1 at home. [f1]";

describe("write_checked_draft", () => {
  it("passes on the first try and strips the fact ids", async () => {
    const draft = await write_checked_draft(new ScriptedLlm([RIGHT]), STORY_SHEET, STORY_NAMES);

    expect(draft).toMatchObject({ body: "Kärpät beat Ilves 3–1 at home.", attempts: 1 });
    expect(draft.check.passed).toBe(true);
    expect(draft.raw_output).toBe(RIGHT);
  });

  it("retries with the failed claims in the prompt", async () => {
    const llm = new ScriptedLlm([WRONG, RIGHT]);

    const draft = await write_checked_draft(llm, STORY_SHEET, STORY_NAMES);

    expect(draft.attempts).toBe(2);
    expect(draft.check.passed).toBe(true);
    expect(llm.prompts[1]).toContain('"4–1": no matching score');
  });

  it("stops after 3 attempts and returns the failed check", async () => {
    const llm = new ScriptedLlm([WRONG]);

    const draft = await write_checked_draft(llm, STORY_SHEET, STORY_NAMES);

    expect(llm.prompts).toHaveLength(3);
    expect(draft.check.passed).toBe(false);
  });

  it("fails a cited fact id that is not in the sheet", async () => {
    const draft = await write_checked_draft(
      new ScriptedLlm(["Kärpät beat Ilves 3–1. [f99]"]),
      STORY_SHEET,
      STORY_NAMES,
    );

    expect(draft.check.failed_claims).toContainEqual(expect.objectContaining({ claim: "[f99]" }));
  });
});

const GAME: StoryGame = {
  id: STORY_SHEET.game_id,
  start_time: new Date("2026-10-24T15:30:00.000Z"),
  home_team_id: "home",
  away_team_id: "away",
  home_team: "Kärpät",
  away_team: "Ilves",
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
};

class FakeStoriesRepository implements StoriesRepository {
  stories: NewStory[] = [];
  sheets: FactSheet[] = [];

  constructor(
    private readonly game: StoryGame | undefined,
    private readonly existing: StoryRow | undefined = undefined,
  ) {}

  find_final_game(): Promise<StoryGame | undefined> {
    return Promise.resolve(this.game);
  }

  list_goals(): Promise<StoryGoalRow[]> {
    return Promise.resolve([
      { team_id: "home", period: 1, game_time_seconds: 877, player_name: "Eetu Laine" },
      { team_id: "away", period: 2, game_time_seconds: 1512, player_name: "Aleksi Mäkelä" },
      { team_id: "home", period: 2, game_time_seconds: 2100, player_name: null },
      { team_id: "home", period: 3, game_time_seconds: 3063, player_name: "Eetu Laine" },
    ]);
  }

  list_games_without_story(): Promise<string[]> {
    return Promise.resolve([]);
  }

  find_story(): Promise<StoryRow | undefined> {
    return Promise.resolve(this.existing);
  }

  save_fact_sheet(sheet: FactSheet): Promise<string> {
    this.sheets.push(sheet);
    return Promise.resolve("sheet-1");
  }

  insert_story(story: NewStory): Promise<string> {
    this.stories.push(story);
    return Promise.resolve("story-1");
  }

  find_published_story(): Promise<PublishedStoryRow | undefined> {
    return Promise.resolve(undefined);
  }

  find_story_by_id(): Promise<StoryRow | undefined> {
    return Promise.resolve(undefined);
  }

  find_editor_id(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  publish_story(): Promise<void> {
    return Promise.resolve();
  }
}

/** No season data (like a demo fill-in): the sheet has the score and the goals only. */
class NoSeasonInputs implements ModelInputsRepository {
  find_current_season(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  find_game_season(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  load_season(): Promise<SeasonRows> {
    return Promise.reject(new Error("not used"));
  }
}

function create_service(repository: StoriesRepository, llm: LlmClient = new MockLlmClient()) {
  return new StoryGenerationService(repository, new NoSeasonInputs(), llm, () => NOW);
}

describe("StoryGenerationService.generate", () => {
  it("stores the fact sheet and a 🟡 story waiting for an editor", async () => {
    const repository = new FakeStoriesRepository(GAME);

    const result = await create_service(repository).generate(GAME.id);

    expect(result).toEqual({ status: "created", story_id: "story-1", traffic_light: "yellow" });
    expect(repository.sheets[0]?.facts.map((fact) => fact.type)).toEqual([
      "final_score",
      "goal",
      "goal",
      "goal",
    ]);
    expect(repository.stories[0]).toMatchObject({
      story_type: "what_it_means",
      language: "en",
      headline: "Kärpät 3–1 Ilves",
      fact_sheet_id: "sheet-1",
      generation_attempts: 1,
      prompt_version: "what_it_means_en_v1",
      model_name: "mock_llm_v1",
      check_result: { passed: true, escalation_words: [], strong_words: [] },
    });
    expect(repository.stories[0]?.body).toContain("Eetu Laine scored the last goal at 51:03.");
  });

  it("sends a story with injury words to 🔴 full review", async () => {
    const repository = new FakeStoriesRepository(GAME);
    const llm = new ScriptedLlm(["Kärpät beat Ilves 3–1 after an injury break. [f1]"]);

    const result = await create_service(repository, llm).generate(GAME.id);

    expect(result.traffic_light).toBe("red");
    expect(repository.stories[0]?.check_result).toMatchObject({ escalation_words: ["injur"] });
  });

  it("sends a story that still fails after 2 retries to 🔴", async () => {
    const repository = new FakeStoriesRepository(GAME);

    const result = await create_service(repository, new ScriptedLlm([WRONG])).generate(GAME.id);

    expect(result.traffic_light).toBe("red");
    expect(repository.stories[0]?.generation_attempts).toBe(3);
  });

  it("does not write a second story for the same game", async () => {
    const repository = new FakeStoriesRepository(GAME, {
      id: "old",
      game_id: GAME.id,
      status: "in_review",
      traffic_light: "yellow",
    });

    const result = await create_service(repository).generate(GAME.id);

    expect(result).toEqual({ status: "exists", story_id: "old", traffic_light: "yellow" });
    expect(repository.stories).toEqual([]);
  });

  it("returns 409 GAME_NOT_FINAL for a game that is not finished", async () => {
    await expect(
      create_service(new FakeStoriesRepository(undefined)).generate(GAME.id),
    ).rejects.toMatchObject({ code: "GAME_NOT_FINAL", http_status: 409 });
  });
});
