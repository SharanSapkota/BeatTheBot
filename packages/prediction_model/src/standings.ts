import { get_game_points, type FinishedGame } from "./game_points";

export interface StandingRow {
  team_id: string;
  rank: number;
  games_played: number;
  points: number;
  goals_for: number;
  goals_against: number;
}

type UnrankedRow = Omit<StandingRow, "rank">;

function empty_row(team_id: string): UnrankedRow {
  return { team_id, games_played: 0, points: 0, goals_for: 0, goals_against: 0 };
}

// Simplified tie-breakers: points, goal difference, goals for, then team_id
// so the order is always the same.
function compare_rows(a: UnrankedRow, b: UnrankedRow): number {
  const goal_difference_a = a.goals_for - a.goals_against;
  const goal_difference_b = b.goals_for - b.goals_against;
  return (
    b.points - a.points ||
    goal_difference_b - goal_difference_a ||
    b.goals_for - a.goals_for ||
    a.team_id.localeCompare(b.team_id)
  );
}

export function compute_standings(
  team_ids: readonly string[],
  games: readonly FinishedGame[],
): StandingRow[] {
  const rows = new Map(team_ids.map((team_id) => [team_id, empty_row(team_id)]));

  for (const game of games) {
    const home_row = rows.get(game.home_team_id);
    const away_row = rows.get(game.away_team_id);
    if (!home_row || !away_row) {
      throw new Error(
        `Game references an unknown team: ${game.home_team_id} vs ${game.away_team_id}`,
      );
    }

    const { home_points, away_points } = get_game_points(game);
    home_row.games_played += 1;
    home_row.points += home_points;
    home_row.goals_for += game.home_goals;
    home_row.goals_against += game.away_goals;
    away_row.games_played += 1;
    away_row.points += away_points;
    away_row.goals_for += game.away_goals;
    away_row.goals_against += game.home_goals;
  }

  return [...rows.values()].sort(compare_rows).map((row, index) => ({ ...row, rank: index + 1 }));
}
