import { expected_goals, game_probabilities } from "./game_probabilities";
import type { PlayedGame } from "./model_types";
import {
  compute_team_strengths,
  default_strength_options,
  regulation_score,
  type StrengthOptions,
} from "./team_strength";

export interface CalibrationBucket {
  /** e.g. "50–60%": the AI's probability for the team it picked. */
  label: string;
  from: number;
  to: number;
  games: number;
  average_predicted: number;
  /** Share of these games the picked team won. */
  actual_rate: number;
}

export interface BacktestResult {
  games: number;
  /** Games left out because a team had played fewer than `min_team_games`. */
  skipped_games: number;
  accuracy: number;
  /** Mean of (home win probability - home won)^2. 0 = perfect, 0.25 = coin flip. */
  brier_score: number;
  /** Always the home team, with the league's home-win rate so far as the probability. */
  baseline_accuracy: number;
  baseline_brier_score: number;
  /** Predicted 60-minute score exactly right. */
  exact_score_rate: number;
  overtime_rate_predicted: number;
  overtime_rate_actual: number;
  calibration: CalibrationBucket[];
}

export interface BacktestOptions {
  min_team_games: number;
  strength_options: StrengthOptions;
}

const BUCKET_EDGES = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];

interface GameRecord {
  home_probability: number;
  home_won: boolean;
  baseline_probability: number;
  exact_score_hit: boolean;
  overtime_probability: number;
  went_to_overtime: boolean;
}

function team_game_counts(history: readonly PlayedGame[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const game of history) {
    counts.set(game.home_team_id, (counts.get(game.home_team_id) ?? 0) + 1);
    counts.set(game.away_team_id, (counts.get(game.away_team_id) ?? 0) + 1);
  }
  return counts;
}

function record_game(
  team_ids: readonly string[],
  history: readonly PlayedGame[],
  game: PlayedGame,
  options: BacktestOptions,
): GameRecord {
  const strengths = compute_team_strengths(team_ids, history, options.strength_options);
  const probabilities = game_probabilities(
    expected_goals(strengths, game.home_team_id, game.away_team_id),
  );
  const score = regulation_score(game);
  const home_wins_so_far = history.filter((past) => past.home_goals > past.away_goals).length;
  return {
    home_probability: probabilities.home_win,
    home_won: game.home_goals > game.away_goals,
    baseline_probability: history.length > 0 ? home_wins_so_far / history.length : 0.5,
    exact_score_hit:
      probabilities.predicted_score.home === score.home &&
      probabilities.predicted_score.away === score.away,
    overtime_probability: probabilities.overtime,
    went_to_overtime: game.ended_in !== "regulation",
  };
}

function mean(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function calibration(records: readonly GameRecord[]): CalibrationBucket[] {
  const picks = records.map((record) => {
    const picked_home = record.home_probability >= 0.5;
    return {
      probability: picked_home ? record.home_probability : 1 - record.home_probability,
      correct: picked_home === record.home_won,
    };
  });
  return BUCKET_EDGES.slice(0, -1).map((from, index) => {
    const to = BUCKET_EDGES[index + 1] ?? 1;
    const in_bucket = picks.filter((pick) => pick.probability >= from && pick.probability < to);
    return {
      label: `${String(Math.round(from * 100))}–${String(Math.min(100, Math.round(to * 100)))}%`,
      from,
      to: Math.min(1, to),
      games: in_bucket.length,
      average_predicted: mean(in_bucket.map((pick) => pick.probability)),
      actual_rate: mean(in_bucket.map((pick) => (pick.correct ? 1 : 0))),
    };
  });
}

/**
 * Walk-forward test: every game is predicted from the games that started before it only,
 * exactly as the live model would have seen the season.
 */
export function backtest(
  team_ids: readonly string[],
  games: readonly PlayedGame[],
  options: Partial<BacktestOptions> = {},
): BacktestResult {
  const settings: BacktestOptions = {
    min_team_games: options.min_team_games ?? 3,
    strength_options: options.strength_options ?? default_strength_options,
  };
  const by_time = [...games].sort(
    (first, second) => first.start_time.getTime() - second.start_time.getTime(),
  );
  const records: GameRecord[] = [];
  let skipped_games = 0;

  for (const game of by_time) {
    const history = by_time.filter((past) => past.start_time.getTime() < game.start_time.getTime());
    const counts = team_game_counts(history);
    const enough_games =
      (counts.get(game.home_team_id) ?? 0) >= settings.min_team_games &&
      (counts.get(game.away_team_id) ?? 0) >= settings.min_team_games;
    if (!enough_games) {
      skipped_games += 1;
      continue;
    }
    records.push(record_game(team_ids, history, game, settings));
  }

  const outcome = (record: GameRecord) => (record.home_won ? 1 : 0);
  return {
    games: records.length,
    skipped_games,
    accuracy: mean(
      records.map((record) => (record.home_probability >= 0.5 === record.home_won ? 1 : 0)),
    ),
    brier_score: mean(records.map((record) => (record.home_probability - outcome(record)) ** 2)),
    baseline_accuracy: mean(
      records.map((record) => (record.baseline_probability >= 0.5 === record.home_won ? 1 : 0)),
    ),
    baseline_brier_score: mean(
      records.map((record) => (record.baseline_probability - outcome(record)) ** 2),
    ),
    exact_score_rate: mean(records.map((record) => (record.exact_score_hit ? 1 : 0))),
    overtime_rate_predicted: mean(records.map((record) => record.overtime_probability)),
    overtime_rate_actual: mean(records.map((record) => (record.went_to_overtime ? 1 : 0))),
    calibration: calibration(records),
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** The back-test as Markdown tables (for docs/reliability_testing.md). */
export function backtest_markdown(result: BacktestResult): string {
  const summary = [
    "| Metric | Model | Baseline (always home) |",
    "|---|---|---|",
    `| Games predicted | ${String(result.games)} (${String(result.skipped_games)} skipped: a team had < 3 games) | |`,
    `| Winner accuracy | ${percent(result.accuracy)} | ${percent(result.baseline_accuracy)} |`,
    `| Brier score (lower is better) | ${result.brier_score.toFixed(4)} | ${result.baseline_brier_score.toFixed(4)} |`,
    `| Exact 60-min score right | ${percent(result.exact_score_rate)} | |`,
    `| Games to overtime: predicted / actual | ${percent(result.overtime_rate_predicted)} / ${percent(result.overtime_rate_actual)} | |`,
  ];
  const calibration = [
    "| AI's probability for its pick | Games | Average predicted | Actually won |",
    "|---|---|---|---|",
    ...result.calibration.map(
      (bucket) =>
        `| ${bucket.label} | ${String(bucket.games)} | ${bucket.games > 0 ? percent(bucket.average_predicted) : "–"} | ${bucket.games > 0 ? percent(bucket.actual_rate) : "–"} |`,
    ),
  ];
  return [...summary, "", ...calibration].join("\n");
}
