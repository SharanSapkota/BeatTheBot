import { env } from "../../config/env";
import { create_database } from "../kysely";
import { delete_demo_room, insert_demo_room } from "../seed/demo_room";

// Usage: pnpm --filter @voita_kone/api rooms:seed_demo
// Recreates only the demo room and its 8 demo members. Other users and rooms stay as they are
// (db:seed recreates all demo data, including every user). Prints no keys.
async function main(): Promise<void> {
  const db = create_database(env.DATABASE_URL);
  try {
    const answers = await db.transaction().execute(async (trx) => {
      await delete_demo_room(trx);
      return insert_demo_room(trx, new Date());
    });
    console.log(`Demo room created with ${String(answers)} demo answers.`);
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
