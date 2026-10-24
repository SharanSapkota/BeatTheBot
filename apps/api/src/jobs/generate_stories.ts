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
  failed_count: number;
}

/**
 * Writes AI previews and AI summaries. Idempotent: a game gets a preview once (plus one refresh
 * 2 h before puck drop) and a summary once it is final. 🟢 stories publish at once; the others
 * wait for an editor. One failing game is logged and the others still run.
 */
export class GenerateStoriesJob {
  constructor(
    private readonly repository: StoriesRepository,
    private readonly generation_service: StoryGenerationService,
    private readonly logger: Logger,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<GenerateStoriesResult> {
    const now = this.clock();
    const preview_ids = await this.repository.list_games_needing_preview(
      now,
      STORY_WINDOW_DAYS,
      PREVIEW_REFRESH_HOURS,
    );
    const summary_ids = await this.repository.list_games_without_story(
      new Date(now.getTime() - STORY_WINDOW_DAYS * DAY_MS),
      "summary",
      STORY_LANGUAGE,
    );
    const result = { previews: 0, summaries: 0, failed_count: 0 };
    const jobs = [
      ...preview_ids.map((game_id) => ({ game_id, type: "preview" as const })),
      ...summary_ids.map((game_id) => ({ game_id, type: "summary" as const })),
    ];
    for (const { game_id, type } of jobs) {
      // Each fact sheet runs season simulations: let the API answer requests in between.
      await yield_to_requests();
      try {
        const story =
          type === "preview"
            ? await this.generation_service.generate_preview(game_id)
            : await this.generation_service.generate_summary(game_id);
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
