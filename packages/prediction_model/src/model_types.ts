import type { FinishedGame } from "./game_points";

/** A finished game the model learns from. `start_time` orders the history. */
export interface PlayedGame extends FinishedGame {
  id: string;
  start_time: Date;
}

/** A game without a result yet (scheduled or still being played). */
export interface ScheduledGame {
  id: string;
  home_team_id: string;
  away_team_id: string;
  start_time: Date;
}

export type Side = "home" | "away";

/** Expected goals of each team in 60 minutes. */
export interface ExpectedGoals {
  home: number;
  away: number;
}
