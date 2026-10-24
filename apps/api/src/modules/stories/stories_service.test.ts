import type { FactSheet } from "@voita_kone/fact_checker";
import { describe, expect, it } from "vitest";
import type { StoryGame, StoryGoalRow } from "./fact_sheet_input";
import type {
  NewStory,
  PublishedStoryRow,
  StoriesRepository,
  StoryRow,
} from "./stories_repository";
import { StoriesService, story_label } from "./stories_service";

// 19:47 UTC = 21:47 in Helsinki (EEST until 25 Oct).
const NOW = new Date("2026-10-24T18:47:00.000Z");

class FakeRepository implements StoriesRepository {
  published: { story_id: string; editor_user_id: string; label_text: string }[] = [];

  constructor(
    private readonly story: StoryRow | undefined,
    /** null = no editor account. */
    private readonly editor_id: string | null = "editor-1",
    private readonly published_row: PublishedStoryRow | undefined = undefined,
  ) {}

  find_final_game(): Promise<StoryGame | undefined> {
    return Promise.resolve(undefined);
  }
  list_goals(): Promise<StoryGoalRow[]> {
    return Promise.resolve([]);
  }
  list_games_without_story(): Promise<string[]> {
    return Promise.resolve([]);
  }
  find_story(): Promise<StoryRow | undefined> {
    return Promise.resolve(undefined);
  }
  save_fact_sheet(_sheet: FactSheet): Promise<string> {
    return Promise.resolve("");
  }
  insert_story(_story: NewStory): Promise<string> {
    return Promise.resolve("");
  }
  find_published_story(): Promise<PublishedStoryRow | undefined> {
    return Promise.resolve(this.published_row);
  }
  find_story_by_id(): Promise<StoryRow | undefined> {
    return Promise.resolve(this.story);
  }
  find_editor_id(): Promise<string | undefined> {
    return Promise.resolve(this.editor_id ?? undefined);
  }
  publish_story(story_id: string, editor_user_id: string, label_text: string): Promise<void> {
    this.published.push({ story_id, editor_user_id, label_text });
    return Promise.resolve();
  }
}

function story(change: Partial<StoryRow>): StoryRow {
  return {
    id: "story-1",
    game_id: "game-1",
    status: "in_review",
    traffic_light: "yellow",
    ...change,
  };
}

describe("StoriesService.approve", () => {
  it("publishes a 🟡 story with the editor's label and time (Helsinki)", async () => {
    const repository = new FakeRepository(story({}));

    const result = await new StoriesService(repository, () => NOW).approve("story-1");

    expect(result.label_text).toBe(
      "AI-written from Liiga data. Checked by Kaleva sports desk, 21:47.",
    );
    expect(repository.published).toEqual([
      { story_id: "story-1", editor_user_id: "editor-1", label_text: result.label_text },
    ]);
  });

  it("refuses 🔴 stories, stories not in review, unknown stories and a missing editor", async () => {
    const approve = (repository: FakeRepository) =>
      new StoriesService(repository, () => NOW).approve("story-1");

    await expect(
      approve(new FakeRepository(story({ traffic_light: "red" }))),
    ).rejects.toMatchObject({
      code: "FULL_REVIEW_NEEDED",
    });
    await expect(approve(new FakeRepository(story({ status: "published" })))).rejects.toMatchObject(
      {
        code: "STORY_NOT_IN_REVIEW",
      },
    );
    await expect(approve(new FakeRepository(undefined))).rejects.toMatchObject({
      code: "STORY_NOT_FOUND",
      http_status: 404,
    });
    await expect(approve(new FakeRepository(story({}), null))).rejects.toMatchObject({
      code: "NO_EDITOR",
    });
  });
});

describe("StoriesService.get_published", () => {
  it("returns the published story, or null when there is none", async () => {
    const row = { id: "s1", headline: "H", body: "B", label_text: story_label(NOW) };

    expect(
      await new StoriesService(new FakeRepository(undefined, "e", row), () => NOW).get_published(
        "game-1",
        "what_it_means",
      ),
    ).toEqual({ id: "s1", headline: "H", body: "B", label_text: row.label_text });
    expect(
      await new StoriesService(new FakeRepository(undefined), () => NOW).get_published(
        "game-1",
        "what_it_means",
      ),
    ).toBeNull();
  });

  it("shows a demo replay's story only at the final moment", async () => {
    const row = { id: "s1", headline: "H", body: "B", label_text: "L" };
    const service = new StoriesService(new FakeRepository(undefined, "e", row), () => NOW);

    expect(await service.get_demo_published("game-1", "what_it_means", "live")).toBeNull();
    expect(await service.get_demo_published("game-1", "what_it_means", "final")).not.toBeNull();
  });
});
