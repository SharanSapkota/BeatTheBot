import type { ExpectedGoals, Side } from "./model_types";
import { poisson_distribution } from "./poisson";
import { model_config } from "./season_config";
import type { StrengthModel } from "./team_strength";

export interface ExactScore {
  home: number;
  away: number;
  probability: number;
}

export interface GameProbabilities {
  expected_goals: ExpectedGoals;
  /** Win probabilities including overtime and shootout; home_win + away_win = 1. */
  home_win: number;
  away_win: number;
  /** Tied after 60 minutes. */
  overtime: number;
  home_regulation_win: number;
  away_regulation_win: number;
  /** Home team's chance to win an overtime / shootout. */
  overtime_home_share: number;
  predicted_winner: Side;
  /** The most likely 60-minute score in which the predicted winner wins. */
  predicted_score: ExactScore;
  /** score_matrix[home][away] = P(60-minute score home–away). */
  score_matrix: number[][];
}

/**
 * home = league home average × home attack × away defence
 * away = league away average × away attack × home defence
 * Home advantage is in the two league averages (measured from the data).
 */
export function expected_goals(
  model: StrengthModel,
  home_team_id: string,
  away_team_id: string,
): ExpectedGoals {
  const home = model.teams.get(home_team_id);
  const away = model.teams.get(away_team_id);
  if (!home || !away) {
    throw new Error(`No strength for ${home_team_id} or ${away_team_id}`);
  }
  return {
    home: model.league_home_goals * home.attack * away.defence,
    away: model.league_away_goals * away.attack * home.defence,
  };
}

/** Overtime is close to a coin flip; the stronger team gets a little more than half. */
export function overtime_home_share(
  expected: ExpectedGoals,
  strength_weight: number = model_config.overtime_strength_weight,
): number {
  const total = expected.home + expected.away;
  const home_share = total > 0 ? expected.home / total : 0.5;
  return 0.5 + strength_weight * (home_share - 0.5);
}

export function score_matrix(expected: ExpectedGoals, max_goals: number): number[][] {
  const home = poisson_distribution(expected.home, max_goals);
  const away = poisson_distribution(expected.away, max_goals);
  return home.map((home_probability) =>
    away.map((away_probability) => home_probability * away_probability),
  );
}

function most_likely_winning_score(matrix: number[][], winner: Side): ExactScore {
  let best: ExactScore =
    winner === "home" ? { home: 1, away: 0, probability: 0 } : { home: 0, away: 1, probability: 0 };
  matrix.forEach((row, home) => {
    row.forEach((probability, away) => {
      const winner_wins = winner === "home" ? home > away : away > home;
      if (winner_wins && probability > best.probability) {
        best = { home, away, probability };
      }
    });
  });
  return best;
}

/** Poisson 60-minute scores, then a tie goes to overtime / shootout. */
export function game_probabilities(
  expected: ExpectedGoals,
  max_goals: number = model_config.max_goals,
): GameProbabilities {
  const matrix = score_matrix(expected, max_goals);
  let home_regulation_win = 0;
  let away_regulation_win = 0;
  let overtime = 0;
  matrix.forEach((row, home) => {
    row.forEach((probability, away) => {
      if (home > away) {
        home_regulation_win += probability;
      } else if (away > home) {
        away_regulation_win += probability;
      } else {
        overtime += probability;
      }
    });
  });
  const ot_home_share = overtime_home_share(expected);
  const home_win = home_regulation_win + overtime * ot_home_share;
  const predicted_winner: Side = home_win >= 0.5 ? "home" : "away";
  return {
    expected_goals: expected,
    home_win,
    away_win: 1 - home_win,
    overtime,
    home_regulation_win,
    away_regulation_win,
    overtime_home_share: ot_home_share,
    predicted_winner,
    predicted_score: most_likely_winning_score(matrix, predicted_winner),
    score_matrix: matrix,
  };
}
