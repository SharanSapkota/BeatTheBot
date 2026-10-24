import { sql } from "kysely";
import { env } from "../../config/env";
import { liiga_source_from_args } from "../../integrations/liiga_client/create_liiga_client";
import { create_database } from "../kysely";
import { migrate_to_latest } from "../migrator";
import { run_seed } from "./seed";

// Drops everything in the dev database, then migrates and seeds it again.
async function main(): Promise<void> {
  if (env.NODE_ENV === "production") {
    throw new Error("db:reset is not allowed when NODE_ENV=production");
  }

  const db = create_database(env.DATABASE_URL);
  try {
    await sql`DROP SCHEMA public CASCADE`.execute(db);
    await sql`CREATE SCHEMA public`.execute(db);
    console.log("Dropped all tables.");
    const steps = await migrate_to_latest(db);
    console.log(steps.join("\n"));
  } finally {
    await db.destroy();
  }

  await run_seed(liiga_source_from_args(process.argv));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
