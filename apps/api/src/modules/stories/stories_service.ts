import type { ReplayMoment, Story } from "@voita_kone/shared_types";
import { formatInTimeZone } from "date-fns-tz";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import { HELSINKI_TIME_ZONE } from "../../common/helsinki_date";
import type { DemoReplayService } from "../demo/demo_replay_service";
import type { StoriesRepository, StoryType } from "./stories_repository";
import { STORY_LANGUAGE } from "./story_generation_service";

/** docs/editorial_rules.md → Labels (yellow/red story, English). */
export function story_label(checked_at: Date): string {
  const time = formatInTimeZone(checked_at, HELSINKI_TIME_ZONE, "HH:mm");
  return `AI-written from Liiga data. Checked by Kaleva sports desk, ${time}.`;
}

function story_not_found(story_id: string): AppError {
  return new AppError("STORY_NOT_FOUND", 404, `Story ${story_id} not found`);
}

/** Published stories for readers, and the editor's approval (CLI now, editor form in step 7). */
export class StoriesService {
  constructor(
    private readonly repository: StoriesRepository,
    private readonly clock: Clock,
    private readonly demo_replay_service?: DemoReplayService,
  ) {}

  /** The published story, or null (not written, or still waiting for an editor). */
  async get_published(game_id: string, story_type: StoryType): Promise<Story | null> {
    const row = await this.repository.find_published_story(game_id, story_type, STORY_LANGUAGE);
    if (!row?.headline || !row.label_text) {
      return null;
    }
    return { id: row.id, headline: row.headline, body: row.body, label_text: row.label_text };
  }

  /** Demo replay: the real game's published story, shown only once the replay is final. */
  async get_demo_published(
    game_id: string,
    story_type: StoryType,
    moment: ReplayMoment,
  ): Promise<Story | null> {
    // Also checks that the game can be replayed (404 GAME_NOT_FOUND otherwise).
    await this.demo_replay_service?.get_game_detail(game_id, moment);
    return moment === "final" ? this.get_published(game_id, story_type) : null;
  }

  /**
   * Publishes a 🟡 story the editor approved. 🔴 stories need a full review (editor form,
   * step 7), so they are refused here.
   */
  async approve(story_id: string): Promise<{ label_text: string }> {
    const story = await this.repository.find_story_by_id(story_id);
    if (!story) {
      throw story_not_found(story_id);
    }
    if (story.status !== "in_review") {
      throw new AppError("STORY_NOT_IN_REVIEW", 409, `Story ${story_id} is ${story.status}`);
    }
    if (story.traffic_light !== "yellow") {
      throw new AppError(
        "FULL_REVIEW_NEEDED",
        409,
        `Story ${story_id} is ${story.traffic_light}: it needs a full review in the editor form`,
      );
    }
    const editor_id = await this.repository.find_editor_id();
    if (!editor_id) {
      throw new AppError("NO_EDITOR", 409, "No editor account exists (run the seed)");
    }
    const now = this.clock();
    const label_text = story_label(now);
    await this.repository.publish_story(story_id, editor_id, label_text, now);
    return { label_text };
  }
}
