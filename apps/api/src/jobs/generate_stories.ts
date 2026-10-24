import type { Clock } from "../common/clock";
import type { Logger } from "../common/logger";
import { yield_to_requests } from "./run_model";
import type { StoriesRepository } from "../modules/stories/stories_repository";
import {
  STORY_LANGUAGE,
  type StoryGenerationService,
} from "../modules/stories/story_generation_service";

/** Only recent games get a story automatically (not the whole season at API start). */
export const STORY_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GenerateStoriesResult {
  created_count: number;
  failed_count: number;
}

/**
 * Writes the "what it means" story for every recently finished game that has none. The
 * stories wait for an editor (🟡 / 🔴); nothing is published here. One failing game is logged
 * and the others still run.
 */
export class GenerateStoriesJob {
  constructor(
    private readonly repository: StoriesRepository,
    private readonly generation_service: StoryGenerationService,
    private readonly logger: Logger,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<GenerateStoriesResult> {
    const since = new Date(this.clock().getTime() - STORY_WINDOW_DAYS * DAY_MS);
    const game_ids = await this.repository.list_games_without_story(
      since,
      "what_it_means",
      STORY_LANGUAGE,
    );
    let created_count = 0;
    let failed_count = 0;
    for (const game_id of game_ids) {
      // Each fact sheet runs two season simulations.
      await yield_to_requests();
      try {
        const result = await this.generation_service.generate(game_id);
        created_count += result.status === "created" ? 1 : 0;
        this.logger.info({ game_id, ...result }, "Story written, waiting for an editor");
      } catch (error) {
        failed_count += 1;
        this.logger.error({ err: error, game_id }, "Story generation failed");
      }
    }
    return { created_count, failed_count };
  }
}
