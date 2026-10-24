import type { Fact } from "@voita_kone/fact_checker";
import type { LastMeeting, ReplayMoment, Story } from "@voita_kone/shared_types";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import type { DemoReplayService } from "../demo/demo_replay_service";
import type { StoriesRepository, StoryRow, StoryType } from "./stories_repository";
import { STORY_LANGUAGE } from "./story_generation_service";

export function story_not_found(story_id: string): AppError {
  return new AppError("STORY_NOT_FOUND", 404, `Story ${story_id} not found`);
}

/** Preview bodies are "- …" lines; the app shows them as bullets. */
export function bullets_of(story_type: string, body: string): string[] {
  if (story_type !== "preview") {
    return [];
  }
  return body
    .split("\n")
    .map((line) => line.trim().replace(/^-\s*/, ""))
    .filter((line) => line.length > 0);
}

export function last_meetings_of(facts: readonly Fact[]): LastMeeting[] {
  return facts.flatMap((fact) =>
    fact.type === "head_to_head"
      ? [
          {
            date: fact.value.date,
            home_team: fact.value.home_team,
            away_team: fact.value.away_team,
            home_goals: fact.value.home_goals,
            away_goals: fact.value.away_goals,
          },
        ]
      : [],
  );
}

export function to_story(row: StoryRow): Story | null {
  if (
    !row.label_text ||
    !row.published_at ||
    (row.story_type !== "preview" && row.story_type !== "summary")
  ) {
    return null;
  }
  return {
    id: row.id,
    story_type: row.story_type,
    headline: row.headline ?? "",
    body: row.body,
    bullets: bullets_of(row.story_type, row.body),
    label_text: row.label_text,
    source: row.source === "template" ? "template" : "llm",
    last_meetings: row.story_type === "preview" ? last_meetings_of(row.facts) : [],
    correction:
      row.corrected_at && row.correction_note
        ? { corrected_at: row.corrected_at.toISOString(), note: row.correction_note }
        : null,
    published_at: row.published_at.toISOString(),
  };
}

/** Published AI previews and summaries for readers, and reader error reports. */
export class StoriesService {
  constructor(
    private readonly repository: StoriesRepository,
    private readonly clock: Clock,
    private readonly demo_replay_service?: DemoReplayService,
  ) {}

  /** The published story, or null (not written yet, or waiting for an editor). */
  async get_published(game_id: string, story_type: StoryType): Promise<Story | null> {
    const row = await this.repository.find_published_story(game_id, story_type, STORY_LANGUAGE);
    return row ? to_story(row) : null;
  }

  /** Demo replay: the real game's preview before puck drop and live, its summary at the end. */
  async get_demo_published(
    game_id: string,
    story_type: StoryType,
    moment: ReplayMoment,
  ): Promise<Story | null> {
    // Also checks that the game can be replayed (404 GAME_NOT_FOUND otherwise).
    await this.demo_replay_service?.get_game_detail(game_id, moment);
    const is_shown = story_type === "summary" ? moment === "final" : moment !== "final";
    return is_shown ? this.get_published(game_id, story_type) : null;
  }

  /** "Report an error": the story goes back to 🟡 and waits for an editor (JSN rule 35). */
  async report(story_id: string, reason: string, user_id: string | null): Promise<void> {
    const story = await this.repository.find_story(story_id);
    if (!story) {
      throw story_not_found(story_id);
    }
    await this.repository.report_story(story_id, reason, user_id, this.clock());
  }
}
