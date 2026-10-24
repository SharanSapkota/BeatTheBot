import type { Fact } from "@voita_kone/fact_checker";
import type { EditorActionResult, EditorClaim, EditorStory } from "@voita_kone/shared_types";
import { editor_claim_schema } from "@voita_kone/shared_types";
import { z } from "zod";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import type { QueueStoryRow, StoriesRepository, StoryRow } from "./stories_repository";
import { AI_STORY_LABEL, TEMPLATE_LABELS } from "./story_generation_service";
import { story_not_found } from "./stories_service";
import { check_text } from "./story_writer";
import { to_traffic_light } from "./traffic_light";

const check_result_schema = z.object({
  claims: z.array(editor_claim_schema).default([]),
  traffic_light_reasons: z.array(z.string()).default([]),
});

/** The default correction note when the editor gives none. */
export const DEFAULT_CORRECTION_NOTE = "Text corrected by the Kaleva sports desk";

function check_details(value: unknown): { claims: EditorClaim[]; reasons: string[] } {
  const parsed = check_result_schema.safeParse(value);
  return parsed.success
    ? { claims: parsed.data.claims, reasons: parsed.data.traffic_light_reasons }
    : { claims: [], reasons: [] };
}

function to_editor_fact(fact: Fact) {
  return { fact_id: fact.fact_id, type: fact.type, value: { ...fact.value }, source: fact.source };
}

export function to_editor_story(row: QueueStoryRow): EditorStory {
  const { claims, reasons } = check_details(row.check_result);
  return {
    id: row.id,
    game_id: row.game_id,
    game: `${row.home_team} vs ${row.away_team}`,
    start_time: row.start_time.toISOString(),
    story_type: row.story_type === "preview" ? "preview" : "summary",
    headline: row.headline ?? "",
    body: row.body,
    traffic_light: to_traffic_light(row.traffic_light),
    reasons,
    source: row.source === "template" ? "template" : "llm",
    claims,
    facts: row.facts.map(to_editor_fact),
    reports: row.reports.map((report) => ({
      reason: report.reason,
      created_at: report.created_at.toISOString(),
    })),
    was_published: row.published_at !== null,
    created_at: row.created_at.toISOString(),
  };
}

function label_of(story: StoryRow): string {
  const type = story.story_type === "preview" ? "preview" : "summary";
  return story.source === "template" ? TEMPLATE_LABELS[type] : AI_STORY_LABEL;
}

/** Editorial decisions stay with humans: approve, edit + approve (checked again), reject. */
export class EditorService {
  constructor(
    private readonly repository: StoriesRepository,
    private readonly clock: Clock,
  ) {}

  async list_queue(): Promise<EditorStory[]> {
    return (await this.repository.list_queue()).map(to_editor_story);
  }

  async approve(editor_user_id: string, story_id: string): Promise<EditorActionResult> {
    const story = await this.waiting_story(story_id);
    const label_text = label_of(story);
    await this.repository.publish_story({
      story_id,
      editor_user_id,
      label_text,
      at: this.clock(),
      edit: null,
    });
    return { id: story_id, status: "published", label_text };
  }

  /**
   * Publishes the editor's text after the fact checker runs again: a wrong claim (a number,
   * name or score the facts contradict) is refused with 422 CHECK_FAILED.
   */
  async edit(
    editor_user_id: string,
    story_id: string,
    body: string,
    note: string | undefined,
  ): Promise<EditorActionResult> {
    const story = await this.waiting_story(story_id);
    const known_names = await this.repository.list_known_names();
    const sheet = {
      game_id: story.game_id,
      built_at: this.clock().toISOString(),
      facts: story.facts,
    };
    const { traffic_light, check } = check_text(story.story_type, body, sheet, known_names, null);
    const wrong = check.claims.filter((claim) => claim.status === "wrong");
    if (wrong.length > 0 || check.tips.length > 0) {
      const problems = [
        ...wrong.map((claim) => `"${claim.claim}" (${claim.reason ?? "wrong"})`),
        ...check.tips.map((tip) => `"${tip}" (tips a winner)`),
      ];
      throw new AppError(
        "CHECK_FAILED",
        422,
        `The fact checker found problems: ${problems.join(", ")}`,
      );
    }
    const correction_note = story.published_at ? (note ?? DEFAULT_CORRECTION_NOTE) : null;
    await this.repository.publish_story({
      story_id,
      editor_user_id,
      label_text: AI_STORY_LABEL,
      at: this.clock(),
      edit: { body, check_result: check, traffic_light, correction_note },
    });
    return {
      id: story_id,
      status: correction_note ? "corrected" : "published",
      label_text: AI_STORY_LABEL,
    };
  }

  async reject(
    editor_user_id: string,
    story_id: string,
    note: string | undefined,
  ): Promise<EditorActionResult> {
    await this.waiting_story(story_id);
    await this.repository.reject_story(story_id, editor_user_id, note ?? null, this.clock());
    return { id: story_id, status: "rejected", label_text: null };
  }

  private async waiting_story(story_id: string): Promise<StoryRow> {
    const story = await this.repository.find_story(story_id);
    if (!story) {
      throw story_not_found(story_id);
    }
    if (story.status !== "in_review") {
      throw new AppError("STORY_NOT_IN_REVIEW", 409, `Story ${story_id} is ${story.status}`);
    }
    return story;
  }
}
