import { env } from "../../config/env";
import { create_database } from "../../db/kysely";
import { KyselyStoriesRepository } from "../../modules/stories/stories_repository";
import { StoriesService } from "../../modules/stories/stories_service";

// Usage: tsx src/jobs/scripts/approve_story.ts <story_id>
// The editor's one-tap approval until the editor form exists (step 7): records a story_review
// by the seeded Kaleva sports desk account and publishes the 🟡 story. 🔴 stories are refused.
async function main(): Promise<void> {
  const story_id = process.argv[2];
  if (!story_id) {
    throw new Error("Usage: pnpm --filter @voita_kone/api stories:approve <story_id>");
  }
  const db = create_database(env.DATABASE_URL);
  try {
    const service = new StoriesService(new KyselyStoriesRepository(db), () => new Date());
    const { label_text } = await service.approve(story_id);
    console.log(`Published. Label: "${label_text}"`);
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
