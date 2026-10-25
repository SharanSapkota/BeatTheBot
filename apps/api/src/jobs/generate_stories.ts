import type { Clock } from "../common/clock";
import type { Logger } from "../common/logger";
import type { StoriesRepository } from "../modules/stories/stories_repository";
import {
  STORY_LANGUAGE,
  type StoryGenerationService,
} from "../modules/stories/story_generation_service";
import { yield_to_requests } from "./run_model";

/** Previews for games in the next (and, for demo replays, the last) 7 days. */
export const STORY_WINDOW_DAYS = 7;
/** A preview is written again once in the 2 hours before puck drop. */
export const PREVIEW_REFRESH_HOURS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GenerateStoriesResult {
  previews: number;
  summaries: number;
  /** Facts unchanged since the last story: no LLM call. */
  skipped: number;
  failed_count: number;
}

export interface GenerateStoriesOptions {
  /** True when an LLM is configured: template stories are written again with it. */
  has_llm: boolean;
}

/**
 * Writes AI previews and AI summaries. Idempotent: a game gets a preview once (plus one refresh
 * 2 h before puck drop, only when its facts changed) and a summary once it is final; each
 * sport's latest results are backfilled, and templates are retried once an LLM works. 🟢 stories publish at once; the others
 * wait for an editor. One failing game is logged and the others still run.
 */
export class GenerateStoriesJob {
  constructor(
    private readonly repository: StoriesRepository,
    private readonly generation_service: StoryGenerationService,
    private readonly logger: Logger,
    private readonly clock: Clock,
    private readonly options: GenerateStoriesOptions = { has_llm: false },
  ) {}

  async run(): Promise<GenerateStoriesResult> {
    const now = this.clock();
    const preview_ids = await this.repository.list_games_needing_preview(
      now,
      STORY_WINDOW_DAYS,
      PREVIEW_REFRESH_HOURS,
    );
    const since = new Date(now.getTime() - STORY_WINDOW_DAYS * DAY_MS);
    const summary_ids = await this.repository.list_games_without_story(
      since,
      "summary",
      STORY_LANGUAGE,
    );
    // Backfill: each sport's latest results get a summary even when they are older than 7 days,
    // so the hub's "Latest results" always has one.
    const backfill_ids = await this.repository.list_latest_results_without_story(
      "summary",
      STORY_LANGUAGE,
    );
    // Template texts are written again once an LLM works (the "retry later").
    const retry = this.options.has_llm
      ? {
          preview: await this.repository.list_template_stories(since, "preview", STORY_LANGUAGE),
          summary: await this.repository.list_template_stories(since, "summary", STORY_LANGUAGE),
        }
      : { preview: [], summary: [] };
    const result = { previews: 0, summaries: 0, skipped: 0, failed_count: 0 };
    const unique = (ids: readonly string[]) => [...new Set(ids)];
    const jobs = [
      ...unique([...preview_ids, ...retry.preview]).map((game_id) => ({
        game_id,
        type: "preview" as const,
      })),
      ...unique([...summary_ids, ...backfill_ids, ...retry.summary]).map((game_id) => ({
        game_id,
        type: "summary" as const,
      })),
    ];
    for (const { game_id, type } of jobs) {
      // Each fact sheet runs season simulations: let the API answer requests in between.
      await yield_to_requests();
      try {
        const story =
          type === "preview"
            ? await this.generation_service.generate_preview(game_id)
            : await this.generation_service.generate_summary(game_id);
        if ("skipped" in story) {
          result.skipped += 1;
          continue;
        }
        result[type === "preview" ? "previews" : "summaries"] += 1;
        this.logger.info({ game_id, type, ...story }, "Story written");
      } catch (error) {
        result.failed_count += 1;
        this.logger.error({ err: error, game_id, type }, "Story generation failed");
      }
    }
    return result;
  }
}
