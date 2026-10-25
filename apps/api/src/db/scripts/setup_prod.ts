import { create_logger } from "../../common/logger";
import { env } from "../../config/env";
import { run_liiga_sync } from "../../jobs/run_liiga_sync";
import { create_liiga_client } from "../../integrations/liiga_client/create_liiga_client";
import { create_database } from "../kysely";
import { migrate_to_latest } from "../migrator";
import { seed_demo_and_score } from "../seed/seed_demo_and_score";

// Usage: pnpm --filter api setup:prod (runs the built dist/scripts/setup_prod.js).
// One-time production setup, safe to re-run:
//   1. migrations, on DATABASE_DIRECT_URL (falls back to DATABASE_URL)
//   2. Liiga sync (the real API, never the saved fixtures) + model + scoring
//   3. demo data, only while the database has no users: the demo seed recreates ALL users,
//      so it never runs again once real fans (or you, the admin) have signed in.
async function migrate(): Promise<void> {
  const db = create_database(env.DATABASE_DIRECT_URL, { max_connections: 1 });
  try {
    const steps = await migrate_to_latest(db);
    console.log(steps.length > 0 ? steps.join("\n") : "Migrations: nothing to migrate.");
  } finally {
    await db.destroy();
  }
}

async function sync_and_seed(): Promise<void> {
  const db = create_database(env.DATABASE_URL, { max_connections: env.DATABASE_POOL_SIZE });
  try {
    console.log("2/3 Syncing Liiga games…");
    const logger = create_logger({ level: "warn", pretty: false });
    const sync_lines = await run_liiga_sync(db, create_liiga_client(env), logger, "the Liiga API");
    console.log(sync_lines.join("\n"));

    const { user_count } = await db
      .selectFrom("users")
      .select((eb) => eb.fn.countAll<string>().as("user_count"))
      .executeTakeFirstOrThrow();
    console.log("3/3 Demo data (first run only)…");
    if (Number(user_count) > 0) {
      console.log(
        `Demo data skipped: the database already has ${user_count} users ` +
          "(the demo seed would delete them).",
      );
      return;
    }
    console.log((await seed_demo_and_score(db, env.ADMIN_EMAILS)).join("\n"));
  } finally {
    await db.destroy();
  }
}

async function main(): Promise<void> {
  console.log("1/3 Migrating the database…");
  await migrate();
  await sync_and_seed();
  console.log("Setup done.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
