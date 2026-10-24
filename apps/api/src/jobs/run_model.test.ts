import { pino } from "pino";
import { describe, expect, it } from "vitest";
import type {
  AiPredictionsRepository,
  CrowdCounts,
  NewModelRun,
  NewPrediction,
  NewTeamOdds,
  SeasonOddsRows,
  StoredPredictionRow,
} from "../modules/ai_predictions/ai_predictions_repository";
import type {
  ModelInputsRepository,
  SeasonRows,
} from "../modules/ai_predictions/model_inputs_repository";
import { SEASON_ROWS } from "../test_helpers/model_rows";
import { RunModelJob, type RunModelOptions } from "./run_model";

const logger = pino({ level: "silent" });
// SEASON_ROWS: "next" starts 2026-10-10, "later" 2026-10-12.
const NOW = new Date("2026-10-10T09:00:00Z");
const FAST: RunModelOptions = {
  window_days: 7,
  season_simulations: 300,
  stakes_simulations: 100,
  seed: 1,
};

class FakeInputsRepository implements ModelInputsRepository {
  constructor(private readonly rows: SeasonRows | undefined) {}

  find_current_season(): Promise<string | undefined> {
    return Promise.resolve(this.rows?.season);
  }

  find_game_season(): Promise<string | undefined> {
    return Promise.resolve(this.rows?.season);
  }

  load_season(): Promise<SeasonRows> {
    if (!this.rows) {
      throw new Error("no rows");
    }
    return Promise.resolve(this.rows);
  }
}

class FakePredictionsRepository implements AiPredictionsRepository {
  runs: {
    run: NewModelRun;
    predictions: readonly NewPrediction[];
    odds: readonly NewTeamOdds[];
  }[] = [];
  predicted = new Set<string>();

  find_latest_prediction(): Promise<StoredPredictionRow | undefined> {
    return Promise.resolve(undefined);
  }

  count_crowd_picks(): Promise<CrowdCounts> {
    return Promise.resolve({ home_picks: 0, draw_picks: 0, total_picks: 0 });
  }

  find_latest_season_odds(): Promise<SeasonOddsRows | undefined> {
    return Promise.resolve(undefined);
  }

  has_run_with_hash(input_hash: string): Promise<boolean> {
    return Promise.resolve(this.runs.some(({ run }) => run.input_hash === input_hash));
  }

  list_predicted_game_ids(game_ids: readonly string[]): Promise<Set<string>> {
    return Promise.resolve(new Set(game_ids.filter((game_id) => this.predicted.has(game_id))));
  }

  save_run(
    run: NewModelRun,
    predictions: readonly NewPrediction[],
    odds: readonly NewTeamOdds[],
  ): Promise<string> {
    this.runs.push({ run, predictions, odds });
    for (const prediction of predictions) {
      this.predicted.add(prediction.game_id);
    }
    return Promise.resolve(`run_${String(this.runs.length)}`);
  }
}

function job(rows: SeasonRows | undefined, repository: FakePredictionsRepository, now = NOW) {
  return new RunModelJob(new FakeInputsRepository(rows), repository, logger, () => now, FAST);
}

describe("RunModelJob", () => {
  it("stores the run, predictions for the next 7 days and odds for every team", async () => {
    const repository = new FakePredictionsRepository();

    const summary = await job(SEASON_ROWS, repository).run();

    expect(summary).toMatchObject({ status: "ran", season: "2026-27", predicted_game_count: 2 });
    const [stored] = repository.runs;
    expect(stored?.run).toMatchObject({
      model_version: "poisson_mc_v1",
      season: "2026-27",
      simulations: 300,
      seed: 1,
    });
    expect(stored?.predictions.map((prediction) => prediction.game_id)).toEqual(["next", "later"]);
    expect(stored?.odds).toHaveLength(3);
    expect(stored?.predictions[0]?.reasons).toBeInstanceOf(Array);
  });

  it("skips the run when the inputs have not changed", async () => {
    const repository = new FakePredictionsRepository();
    await job(SEASON_ROWS, repository).run();

    const summary = await job(SEASON_ROWS, repository).run();

    expect(summary.status).toBe("skipped");
    expect(repository.runs).toHaveLength(1);
  });

  it("keeps the prediction a started game already has", async () => {
    const repository = new FakePredictionsRepository();
    repository.predicted.add("next");
    const rows: SeasonRows = {
      ...SEASON_ROWS,
      games: SEASON_ROWS.games.map((game) =>
        game.id === "next" ? { ...game, status: "live" } : game,
      ),
    };

    await job(rows, repository, new Date("2026-10-10T16:00:00Z")).run();

    expect(repository.runs[0]?.predictions.map((prediction) => prediction.game_id)).toEqual([
      "later",
    ]);
  });

  it("predicts a started game that has no prediction yet", async () => {
    const repository = new FakePredictionsRepository();
    const rows: SeasonRows = {
      ...SEASON_ROWS,
      games: SEASON_ROWS.games.map((game) =>
        game.id === "next" ? { ...game, status: "live" } : game,
      ),
    };

    await job(rows, repository, new Date("2026-10-10T16:00:00Z")).run();

    expect(repository.runs[0]?.predictions.map((prediction) => prediction.game_id)).toEqual([
      "next",
      "later",
    ]);
  });

  it("does nothing without synced data", async () => {
    const repository = new FakePredictionsRepository();

    expect((await job(undefined, repository).run()).status).toBe("no_data");
    expect(repository.runs).toEqual([]);
  });
});
