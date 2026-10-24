import { create_logger } from "../../common/logger";
import { env } from "../../config/env";
import { create_database } from "../../db/kysely";
import { create_llm_client } from "../../integrations/llm_client/create_llm_client";
import { KyselyModelInputsRepository } from "../../modules/ai_predictions/model_inputs_repository";
import { KyselyStoriesRepository } from "../../modules/stories/stories_repository";
import { StoryGenerationService } from "../../modules/stories/story_generation_service";
import { GenerateStoriesJob } from "../generate_stories";

// Usage: tsx src/jobs/scripts/generate_stories.ts [game_id]
// Without a game id: every game finished in the last 7 days that has no story yet.
async function main(): Promise<void> {
  const game_id = process.argv[2];
  const db = create_database(env.DATABASE_URL);
  try {
    const repository = new KyselyStoriesRepository(db);
    const service = new StoryGenerationService(
      repository,
      new KyselyModelInputsRepository(db),
      create_llm_client(),
      () => new Date(),
    );
    if (game_id) {
      const result = await service.generate(game_id);
      console.log(`Story ${result.status}: ${result.story_id} (${result.traffic_light}).`);
      return;
    }
    const logger = create_logger({ level: "warn", pretty: false });
    const result = await new GenerateStoriesJob(
      repository,
      service,
      logger,
      () => new Date(),
    ).run();
    console.log(
      `Stories written: ${String(result.created_count)}, failed: ${String(result.failed_count)}. They wait for an editor.`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
