import { create_logger } from "../../common/logger";
import { env } from "../../config/env";
import { ScorePredictionsJob } from "../../jobs/score_predictions";
import { KyselyScorePredictionsRepository } from "../../jobs/score_predictions_repository";
import { create_database } from "../kysely";
import { insert_sample_sports } from "../seed/demo_sports";

// Usage: pnpm --filter @voita_kone/api sports:seed_demo
// Recreates only the sample football and basketball games (relative to now) and the demo users'
// picks on them. Liiga data, users and admin-entered matches stay as they are.
async function main(): Promise<void> {
  const db = create_database(env.DATABASE_URL);
  try {
    const summary = await db.transaction().execute(async (trx) => {
      const identities = await trx
        .selectFrom("auth_identities")
        .select(["provider_subject", "user_id"])
        .where("provider", "=", "device")
        .where("provider_subject", "like", "demo_device_%")
        .execute();
      const user_ids = new Map(identities.map((row) => [row.provider_subject, row.user_id]));
      return insert_sample_sports(trx, new Date(), user_ids);
    });
    const scoring = await new ScorePredictionsJob(
      new KyselyScorePredictionsRepository(db),
      create_logger({ level: "warn", pretty: false }),
      () => new Date(),
    ).run();
    console.log(
      `Sample sports: ${String(summary.game_count)} games, ${String(summary.pick_count)} demo picks ` +
        `(${String(scoring.scored_prediction_count)} scored).`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
