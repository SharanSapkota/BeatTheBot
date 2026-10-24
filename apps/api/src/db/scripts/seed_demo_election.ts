import { env } from "../../config/env";
import { create_database } from "../kysely";
import { delete_demo_election, insert_demo_election } from "../seed/demo_election";

// Usage: pnpm --filter @voita_kone/api elections:seed_demo
// Recreates only the demo election and its 30 demo voters. Other users and games stay as they are
// (db:seed recreates all demo data, including every user).
async function main(): Promise<void> {
  const db = create_database(env.DATABASE_URL);
  try {
    const picks = await db.transaction().execute(async (trx) => {
      await delete_demo_election(trx);
      return insert_demo_election(trx, new Date());
    });
    console.log(`Demo election created with ${String(picks)} demo picks.`);
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
