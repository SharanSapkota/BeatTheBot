import { sql } from "kysely";
import { z } from "zod";
import { env } from "../../config/env";
import { create_database } from "../kysely";

// Usage: pnpm --filter @voita_kone/api rooms:advance_slot -- --room_id <uuid>
// Dev and e2e only (a fake clock for one room): moves the room's schedule and its questions one
// interval into the past, so the current question is revealed now and the next one opens.
// Refuses to run with NODE_ENV=production. Prints no keys.
function room_id_from_args(args: readonly string[]): string {
  const index = args.indexOf("--room_id");
  return z.uuid().parse(args[index + 1]);
}

async function main(): Promise<void> {
  if (env.NODE_ENV === "production") {
    throw new Error("rooms:advance_slot is for development and tests only");
  }
  const room_id = room_id_from_args(process.argv);
  const db = create_database(env.DATABASE_URL);
  try {
    await db.transaction().execute(async (trx) => {
      const room = await trx
        .selectFrom("rooms")
        .select(["question_interval_seconds"])
        .where("id", "=", room_id)
        .executeTakeFirstOrThrow(() => new Error("No room with this id"));
      const shift = sql`make_interval(secs => ${room.question_interval_seconds})`;
      await trx
        .updateTable("rooms")
        .set({ schedule_started_at: sql<Date>`schedule_started_at - ${shift}` })
        .where("id", "=", room_id)
        .execute();
      await trx
        .updateTable("room_questions")
        .set({
          opens_at: sql<Date>`opens_at - ${shift}`,
          locks_at: sql<Date>`locks_at - ${shift}`,
        })
        .where("room_id", "=", room_id)
        .execute();
    });
    console.log("Room moved one slot ahead.");
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
