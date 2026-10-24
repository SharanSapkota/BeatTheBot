import { season_config } from "./season_config";

export type EndedIn = "regulation" | "overtime" | "shootout";

export interface FinishedGame {
  home_team_id: string;
  away_team_id: string;
  home_goals: number;
  away_goals: number;
  ended_in: EndedIn;
}

export interface GamePoints {
  home_points: number;
  away_points: number;
}

// Liiga points: regulation win 3, OT/SO win 2, OT/SO loss 1, regulation loss 0.
// The final score includes the overtime or shootout winning goal, so it is never a tie.
export function get_game_points(game: FinishedGame): GamePoints {
  if (game.home_goals === game.away_goals) {
    throw new Error("A finished game cannot end in a tie");
  }

  const { points } = season_config;
  const home_won = game.home_goals > game.away_goals;
  const winner_points =
    game.ended_in === "regulation" ? points.regulation_win : points.overtime_win;
  const loser_points =
    game.ended_in === "regulation" ? points.regulation_loss : points.overtime_loss;

  return home_won
    ? { home_points: winner_points, away_points: loser_points }
    : { home_points: loser_points, away_points: winner_points };
}
