import { create_logger } from "../../common/logger";
import { env } from "../../config/env";
import { create_database } from "../../db/kysely";
import { KyselyAiPredictionsRepository } from "../../modules/ai_predictions/ai_predictions_repository";
import { KyselyModelInputsRepository } from "../../modules/ai_predictions/model_inputs_repository";
import { RunModelJob } from "../run_model";

// Usage: tsx src/jobs/scripts/run_model.ts
// Runs the prediction model once on the synced data (skipped when the inputs are unchanged).
async function main(): Promise<void> {
  const db = create_database(env.DATABASE_URL);
  try {
    const job = new RunModelJob(
      new KyselyModelInputsRepository(db),
      new KyselyAiPredictionsRepository(db),
      create_logger({ level: env.LOG_LEVEL, pretty: true }),
      () => new Date(),
    );
    const summary = await job.run();
    console.log(
      `Model ${summary.status} (${summary.season ?? "no season"}): ` +
        `${String(summary.predicted_game_count)} games predicted, ` +
        `${String(summary.team_count)} teams simulated, ${String(summary.duration_ms)} ms.`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
