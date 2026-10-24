import {
  compute_team_strengths,
  model_config,
  simulate_season,
  table_rules,
  type GamePrediction,
} from "@voita_kone/prediction_model";
import type { Clock } from "../common/clock";
import { helsinki_day_range, to_helsinki_date } from "../common/helsinki_date";
import type { Logger } from "../common/logger";
import {
  to_new_prediction,
  to_new_team_odds,
} from "../modules/ai_predictions/ai_predictions_mapper";
import type { AiPredictionsRepository } from "../modules/ai_predictions/ai_predictions_repository";
import {
  compute_input_hash,
  predict_from_season,
  remaining_games,
  to_season_data,
  type SeasonData,
} from "../modules/ai_predictions/model_inputs";
import type {
  ModelGameRow,
  ModelInputsRepository,
} from "../modules/ai_predictions/model_inputs_repository";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RunModelOptions {
  /** Upcoming games this many days ahead get a prediction. */
  window_days: number;
  season_simulations: number;
  stakes_simulations: number;
  seed: number;
}

export const default_run_model_options: RunModelOptions = {
  window_days: 7,
  season_simulations: model_config.season_simulations,
  stakes_simulations: model_config.stakes_simulations,
  seed: model_config.seed,
};

export interface RunModelSummary {
  status: "ran" | "skipped" | "no_data";
  season: string | null;
  predicted_game_count: number;
  team_count: number;
  duration_ms: number;
  model_run_id: string | null;
}

/** Lets the event loop answer requests between two heavy calculations. */
export function yield_to_requests(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Runs the prediction model on the synced data and stores the result:
 * season odds (10,000 simulations) and a pre-game prediction for every game from the start
 * of today (Helsinki) to 7 days ahead. Upcoming games are re-predicted when the inputs
 * change; a game that has started keeps the prediction it already has. A game that started
 * without one (e.g. the first run of the day) is predicted from the data before its puck drop.
 */
export class RunModelJob {
  constructor(
    private readonly inputs_repository: ModelInputsRepository,
    private readonly predictions_repository: AiPredictionsRepository,
    private readonly logger: Logger,
    private readonly clock: Clock,
    private readonly options: RunModelOptions = default_run_model_options,
  ) {}

  async run(): Promise<RunModelSummary> {
    const started = Date.now();
    const run_at = this.clock();
    const season = await this.inputs_repository.find_current_season();
    if (!season) {
      return this.summary("no_data", null, 0, 0, started, null);
    }
    const data = to_season_data(await this.inputs_repository.load_season(season));
    const window = this.games_in_window(data, run_at);
    const input_hash = compute_input_hash(data, window);
    if (await this.predictions_repository.has_run_with_hash(input_hash)) {
      this.logger.info({ season }, "Model run skipped: inputs unchanged");
      return this.summary("skipped", season, 0, data.team_ids.length, started, null);
    }

    const already_predicted = await this.predictions_repository.list_predicted_game_ids(
      window.map((game) => game.id),
    );
    const targets = window.filter(
      (game) => game.status === "scheduled" || !already_predicted.has(game.id),
    );
    const odds = await this.simulate_season(data);
    const predictions = await this.predict(data, targets);
    const duration_ms = Date.now() - started;
    const model_run_id = await this.predictions_repository.save_run(
      {
        run_at,
        model_version: model_config.model_version,
        season,
        simulations: this.options.season_simulations,
        seed: this.options.seed,
        input_hash,
        duration_ms,
      },
      predictions.map(to_new_prediction),
      to_new_team_odds(odds),
    );
    const summary = this.summary(
      "ran",
      season,
      predictions.length,
      odds.length,
      started,
      model_run_id,
    );
    this.logger.info(summary, "Model run stored");
    return summary;
  }

  /** Real games from the start of today (Helsinki) to `window_days` ahead. */
  private games_in_window(data: SeasonData, now: Date): ModelGameRow[] {
    const from = helsinki_day_range(to_helsinki_date(now)).start.getTime();
    const to = now.getTime() + this.options.window_days * DAY_MS;
    return data.games.filter((game) => {
      const start = game.start_time.getTime();
      return start >= from && start < to;
    });
  }

  private async simulate_season(data: SeasonData) {
    await yield_to_requests();
    return simulate_season({
      team_ids: data.team_ids,
      played_games: data.played,
      remaining_games: remaining_games(data, data.played),
      strengths: compute_team_strengths(data.team_ids, data.played),
      rules: table_rules,
      simulations: this.options.season_simulations,
      seed: this.options.seed,
    });
  }

  private async predict(
    data: SeasonData,
    targets: readonly ModelGameRow[],
  ): Promise<GamePrediction[]> {
    // Upcoming games all see the same history (every finished game), so they share strengths.
    const current_strengths = compute_team_strengths(data.team_ids, data.played);
    const predictions: GamePrediction[] = [];
    for (const game of targets) {
      await yield_to_requests();
      predictions.push(
        predict_from_season(data, game, {
          strengths: game.status === "scheduled" ? current_strengths : undefined,
          stakes_simulations: this.options.stakes_simulations,
          seed: this.options.seed,
        }),
      );
    }
    return predictions;
  }

  private summary(
    status: RunModelSummary["status"],
    season: string | null,
    predicted_game_count: number,
    team_count: number,
    started: number,
    model_run_id: string | null,
  ): RunModelSummary {
    return {
      status,
      season,
      predicted_game_count,
      team_count,
      duration_ms: Date.now() - started,
      model_run_id,
    };
  }
}
