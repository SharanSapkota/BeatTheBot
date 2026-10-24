import type { FormResult, Standings } from "@voita_kone/shared_types";
import { to_team_summary } from "../teams/teams_mapper";
import type { FinishedGameRecord, StandingsRepository } from "./standings_repository";

const FORM_LENGTH = 5;

/** One finished game from one team's point of view. */
export function to_form_result(game: FinishedGameRecord, team_id: string): FormResult {
  const is_home = game.home_team_id === team_id;
  const own_goals = is_home ? game.home_goals : game.away_goals;
  const other_goals = is_home ? game.away_goals : game.home_goals;
  const after_regulation = game.ended_in !== "regulation";
  if (own_goals > other_goals) {
    return after_regulation ? "OTW" : "W";
  }
  return after_regulation ? "OTL" : "L";
}

/** The team's last 5 results, newest first. `games` must be sorted newest first. */
export function compute_form(team_id: string, games: readonly FinishedGameRecord[]): FormResult[] {
  return games
    .filter((game) => game.home_team_id === team_id || game.away_team_id === team_id)
    .slice(0, FORM_LENGTH)
    .map((game) => to_form_result(game, team_id));
}

export class StandingsService {
  constructor(private readonly standings_repository: StandingsRepository) {}

  /** The latest standings snapshot. An unknown season returns empty rows. */
  async get_standings(season?: string): Promise<Standings> {
    const snapshot = await this.standings_repository.find_latest_snapshot(season);
    if (!snapshot) {
      return { season: season ?? "", taken_at: null, rows: [] };
    }
    const [rows, games] = await Promise.all([
      this.standings_repository.list_rows(snapshot),
      this.standings_repository.list_finished_games(snapshot.season),
    ]);
    return {
      season: snapshot.season,
      taken_at: snapshot.taken_at.toISOString(),
      rows: rows.map((row) => ({
        rank: row.rank,
        team: to_team_summary(row.team),
        games_played: row.games_played,
        points: row.points,
        goals_for: row.goals_for,
        goals_against: row.goals_against,
        goal_difference: row.goals_for - row.goals_against,
        form: compute_form(row.team.id, games),
      })),
    };
  }
}
