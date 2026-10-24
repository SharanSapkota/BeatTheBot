import type { ExpectedGoals, Side } from "./model_types";
import { poisson_distribution } from "./poisson";
import { model_config } from "./season_config";

export const REGULATION_SECONDS = 60 * 60;

export interface LiveScore {
  home_goals: number;
  away_goals: number;
  /** Seconds since puck drop. 3600 and more = overtime. */
  elapsed_seconds: number;
}

/** The pre-game numbers the live chance starts from. */
export interface LiveModel {
  expected_goals: ExpectedGoals;
  overtime_home_share: number;
}

/**
 * Home win chance during a game: the goals still to come in the remaining regulation time
 * are Poisson with the pre-game expected goals scaled to the time left; a tie after 60
 * minutes goes to overtime. In overtime the next goal wins, so a lead there is final.
 */
export function live_home_win_probability(score: LiveScore, model: LiveModel): number {
  const lead = score.home_goals - score.away_goals;
  if (score.elapsed_seconds >= REGULATION_SECONDS) {
    if (lead === 0) {
      return model.overtime_home_share;
    }
    return lead > 0 ? 1 : 0;
  }
  const time_left = (REGULATION_SECONDS - Math.max(0, score.elapsed_seconds)) / REGULATION_SECONDS;
  const home_more = poisson_distribution(
    model.expected_goals.home * time_left,
    model_config.max_goals,
  );
  const away_more = poisson_distribution(
    model.expected_goals.away * time_left,
    model_config.max_goals,
  );

  let home_win = 0;
  home_more.forEach((home_probability, home_goals) => {
    away_more.forEach((away_probability, away_goals) => {
      const final_lead = lead + home_goals - away_goals;
      const probability = home_probability * away_probability;
      if (final_lead > 0) {
        home_win += probability;
      } else if (final_lead === 0) {
        home_win += probability * model.overtime_home_share;
      }
    });
  });
  return home_win;
}

export interface TimelineGoal {
  game_time_seconds: number;
  side: Side;
}

export type WinChancePointKind = "start" | "goal" | "now" | "end";

export interface WinChancePoint {
  kind: WinChancePointKind;
  game_time_seconds: number;
  home_goals: number;
  away_goals: number;
  home_win_probability: number;
}

export interface TimelineInput {
  model: LiveModel;
  /** Goals in regulation and overtime (no shootout attempts), any order. */
  goals: readonly TimelineGoal[];
  /** Live: the current game time; adds a "now" point. */
  now_seconds?: number;
  /** Final: the winner; adds an "end" point at 100% / 0%. */
  final_winner?: Side;
}

/** One point at puck drop, one after every goal, then "now" (live) or "end" (final). */
export function build_win_chance_timeline(input: TimelineInput): WinChancePoint[] {
  const goals = [...input.goals]
    .filter(
      (goal) => input.now_seconds === undefined || goal.game_time_seconds <= input.now_seconds,
    )
    .sort((first, second) => first.game_time_seconds - second.game_time_seconds);
  const score = { home_goals: 0, away_goals: 0 };
  const point = (kind: WinChancePointKind, game_time_seconds: number): WinChancePoint => ({
    kind,
    game_time_seconds,
    ...score,
    home_win_probability: live_home_win_probability(
      { ...score, elapsed_seconds: game_time_seconds },
      input.model,
    ),
  });

  const points: WinChancePoint[] = [point("start", 0)];
  for (const goal of goals) {
    if (goal.side === "home") {
      score.home_goals += 1;
    } else {
      score.away_goals += 1;
    }
    points.push(point("goal", goal.game_time_seconds));
  }
  if (input.final_winner) {
    points.push({
      kind: "end",
      game_time_seconds: Math.max(REGULATION_SECONDS, goals.at(-1)?.game_time_seconds ?? 0),
      ...score,
      home_win_probability: input.final_winner === "home" ? 1 : 0,
    });
  } else if (input.now_seconds !== undefined) {
    points.push(point("now", input.now_seconds));
  }
  return points;
}
