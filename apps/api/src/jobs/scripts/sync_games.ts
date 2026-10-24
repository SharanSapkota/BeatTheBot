import { env } from "../../config/env";
import { create_database } from "../../db/kysely";
import {
  create_liiga_client,
  liiga_source_from_args,
} from "../../integrations/liiga_client/create_liiga_client";
import { create_logger } from "../../common/logger";
import { KyselyAiPredictionsRepository } from "../../modules/ai_predictions/ai_predictions_repository";
import { KyselyModelInputsRepository } from "../../modules/ai_predictions/model_inputs_repository";
import { RunModelJob } from "../run_model";
import { ScoreAnswersJob } from "../score_answers";
import { KyselyScoreAnswersRepository } from "../score_answers_repository";
import { ScorePredictionsJob } from "../score_predictions";
import { KyselyScorePredictionsRepository } from "../score_predictions_repository";
import { describe_sync_summary, SyncGamesJob } from "../sync_games";
import { KyselySyncGamesRepository } from "../sync_games_repository";

// Usage: tsx src/jobs/scripts/sync_games.ts [--fixtures]
// After the sync the prediction model runs (skipped when its inputs did not change), then
// picks of newly finished games are scored.
async function main(): Promise<void> {
  const source = liiga_source_from_args(process.argv);
  const db = create_database(env.DATABASE_URL);
  try {
    const job = new SyncGamesJob(
      create_liiga_client(env, source),
      new KyselySyncGamesRepository(db),
      () => new Date(),
    );
    console.log(`Synced from ${source}. ${describe_sync_summary(await job.run())}`);
    const logger = create_logger({ level: "warn", pretty: false });
    const model_job = new RunModelJob(
      new KyselyModelInputsRepository(db),
      new KyselyAiPredictionsRepository(db),
      logger,
      () => new Date(),
    );
    const model = await model_job.run();
    console.log(
      `Model ${model.status}: ${String(model.predicted_game_count)} games predicted in ${String(model.duration_ms)} ms.`,
    );
    const scoring = await new ScorePredictionsJob(
      new KyselyScorePredictionsRepository(db),
      logger,
      () => new Date(),
    ).run();
    console.log(
      `Scored ${String(scoring.scored_prediction_count)} picks in ${String(scoring.scored_game_count)} finished games.`,
    );
    const answers = await new ScoreAnswersJob(new KyselyScoreAnswersRepository(db), logger).run();
    console.log(
      `Decided ${String(answers.closed_question_count)} live questions, scored ${String(answers.scored_answer_count)} answers.`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
