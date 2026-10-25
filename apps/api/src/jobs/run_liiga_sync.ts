import type { Logger } from "../common/logger";
import type { Database } from "../db/kysely";
import type { LiigaClient } from "../integrations/liiga_client/liiga_client";
import { KyselyAiPredictionsRepository } from "../modules/ai_predictions/ai_predictions_repository";
import { KyselyModelInputsRepository } from "../modules/ai_predictions/model_inputs_repository";
import { RunModelJob } from "./run_model";
import { ScoreAnswersJob } from "./score_answers";
import { KyselyScoreAnswersRepository } from "./score_answers_repository";
import { ScorePredictionsJob } from "./score_predictions";
import { KyselyScorePredictionsRepository } from "./score_predictions_repository";
import { describe_sync_summary, SyncGamesJob } from "./sync_games";
import { KyselySyncGamesRepository } from "./sync_games_repository";

/**
 * The Liiga sync with its follow-up jobs, for the sync:liiga and setup:prod scripts: sync, then
 * the prediction model (skipped when its inputs did not change), then picks of newly finished
 * games are scored and live questions decided. Idempotent. Returns one line per step.
 */
export async function run_liiga_sync(
  db: Database,
  liiga_client: LiigaClient,
  logger: Logger,
  source_name: string,
): Promise<string[]> {
  const clock = () => new Date();
  const lines: string[] = [];
  const job = new SyncGamesJob(liiga_client, new KyselySyncGamesRepository(db), clock);
  lines.push(`Synced from ${source_name}. ${describe_sync_summary(await job.run())}`);
  const model = await new RunModelJob(
    new KyselyModelInputsRepository(db),
    new KyselyAiPredictionsRepository(db),
    logger,
    clock,
  ).run();
  lines.push(
    `Model ${model.status}: ${String(model.predicted_game_count)} games predicted in ${String(model.duration_ms)} ms.`,
  );
  const scoring = await new ScorePredictionsJob(
    new KyselyScorePredictionsRepository(db),
    logger,
    clock,
  ).run();
  lines.push(
    `Scored ${String(scoring.scored_prediction_count)} picks in ${String(scoring.scored_game_count)} finished games.`,
  );
  const answers = await new ScoreAnswersJob(new KyselyScoreAnswersRepository(db), logger).run();
  lines.push(
    `Decided ${String(answers.closed_question_count)} live questions, scored ${String(answers.scored_answer_count)} answers.`,
  );
  return lines;
}
