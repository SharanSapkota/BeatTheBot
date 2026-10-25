import { create_logger } from "../../common/logger";
import { env } from "../../config/env";
import { create_database } from "../../db/kysely";
import { create_llm_client } from "../../integrations/llm_client/create_llm_client";
import { KyselyModelInputsRepository } from "../../modules/ai_predictions/model_inputs_repository";
import { KyselyStoriesRepository } from "../../modules/stories/stories_repository";
import { StoryGenerationService } from "../../modules/stories/story_generation_service";
import { GenerateStoriesJob } from "../generate_stories";

// Usage: tsx src/jobs/scripts/generate_stories.ts [preview|summary <game_id>]
// Without arguments: the same run as the API's job (previews in the 7-day window, summaries
// of finished games). With a type and a game id: writes that story again.
async function main(): Promise<void> {
  const [type, game_id] = process.argv.slice(2);
  const db = create_database(env.DATABASE_URL);
  try {
    const repository = new KyselyStoriesRepository(db);
    const llm_client = create_llm_client(env);
    const service = new StoryGenerationService(
      repository,
      new KyselyModelInputsRepository(db),
      llm_client,
      () => new Date(),
    );
    if (type && game_id) {
      const result =
        type === "preview"
          ? await service.generate_preview(game_id)
          : await service.generate_summary(game_id);
      console.log(
        "skipped" in result
          ? "Facts unchanged since the last story: nothing written."
          : `Story ${result.story_id}: ${result.traffic_light} (${result.source}).`,
      );
      return;
    }
    const logger = create_logger({ level: "warn", pretty: false });
    const result = await new GenerateStoriesJob(
      repository,
      service,
      logger,
      () => new Date(),
      { has_llm: llm_client !== undefined },
    ).run();
    console.log(
      `Previews: ${String(result.previews)}, summaries: ${String(result.summaries)}, unchanged: ${String(result.skipped)}, failed: ${String(result.failed_count)}.`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
