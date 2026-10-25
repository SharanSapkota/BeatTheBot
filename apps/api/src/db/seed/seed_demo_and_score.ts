import { create_logger } from "../../common/logger";
import { ScorePredictionsJob } from "../../jobs/score_predictions";
import { KyselyScorePredictionsRepository } from "../../jobs/score_predictions_repository";
import type { Database } from "../kysely";
import { FALLBACK_EDITOR_EMAIL } from "./demo_users";
import { seed_demo_data, type SeedSummary } from "./seed_demo_data";

function describe_seed_summary(summary: SeedSummary): string {
  return (
    `Demo data: ${String(summary.user_count)} users, ${String(summary.prediction_count)} picks, ` +
    `demo election with ${String(summary.election_pick_count)} picks, ` +
    `demo room with ${String(summary.room_answer_count)} answers, ` +
    `${String(summary.sample_game_count)} sample football/basketball games ` +
    `(${String(summary.sample_pick_count)} picks).`
  );
}

/**
 * The demo seed (it recreates ALL users, see seed_demo_data), then scores the demo users' picks,
 * which are on finished games. The Liiga sync must have run first. Returns one line per step.
 */
export async function seed_demo_and_score(
  db: Database,
  admin_emails: readonly string[],
): Promise<string[]> {
  const lines: string[] = [];
  const editor_email = admin_emails[0] ?? FALLBACK_EDITOR_EMAIL;
  if (!admin_emails[0]) {
    lines.push(`ADMIN_EMAILS is empty, so the demo editor is ${FALLBACK_EDITOR_EMAIL}.`);
  }
  lines.push(describe_seed_summary(await seed_demo_data(db, { now: new Date(), editor_email })));
  const scoring = await new ScorePredictionsJob(
    new KyselyScorePredictionsRepository(db),
    create_logger({ level: "warn", pretty: false }),
    () => new Date(),
  ).run();
  lines.push(`Scored ${String(scoring.scored_prediction_count)} demo picks.`);
  return lines;
}
