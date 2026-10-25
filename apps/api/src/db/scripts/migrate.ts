import { env } from "../../config/env";
import { create_database } from "../kysely";
import { migrate_down_one, migrate_to_latest } from "../migrator";

// Usage: tsx src/db/scripts/migrate.ts [latest|down] (built: node dist/scripts/migrate.js).
// Uses DATABASE_DIRECT_URL (falls back to DATABASE_URL): Neon's pooler is not for DDL.
async function main(): Promise<void> {
  const direction = process.argv[2] ?? "latest";
  if (direction !== "latest" && direction !== "down") {
    throw new Error(`Unknown direction "${direction}". Use "latest" or "down".`);
  }

  const db = create_database(env.DATABASE_DIRECT_URL, { max_connections: 1 });
  try {
    const steps = direction === "latest" ? await migrate_to_latest(db) : await migrate_down_one(db);
    console.log(steps.length > 0 ? steps.join("\n") : "Nothing to migrate.");
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
