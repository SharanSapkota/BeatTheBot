import {
  position_schema,
  type PlayerSummary,
  type Sport,
  type TeamSummary,
} from "@voita_kone/shared_types";
import { season_config } from "@voita_kone/prediction_model";
import { AppError } from "../../common/app_error";
import { to_sport, to_team_summary } from "./teams_mapper";
import type { PlayerRow, TeamsRepository } from "./teams_repository";

// Roster order for the scorer pick: goalies, defense, forwards, then players without a role.
const POSITION_ORDER: Record<string, number> = { goalie: 0, defense: 1, forward: 2 };
const UNKNOWN_ORDER = 3;
const NO_JERSEY = 100;

export function team_not_found(team_id: string): AppError {
  return new AppError("TEAM_NOT_FOUND", 404, `Team ${team_id} not found`);
}

export function compare_roster_order(first: PlayerRow, second: PlayerRow): number {
  const position_of = (player: PlayerRow) =>
    player.position ? (POSITION_ORDER[player.position] ?? UNKNOWN_ORDER) : UNKNOWN_ORDER;
  return (
    position_of(first) - position_of(second) ||
    (first.jersey_number ?? NO_JERSEY) - (second.jersey_number ?? NO_JERSEY) ||
    first.last_name.localeCompare(second.last_name, "fi")
  );
}

function to_player_summary(player: PlayerRow): PlayerSummary {
  return {
    id: player.id,
    first_name: player.first_name,
    last_name: player.last_name,
    jersey_number: player.jersey_number,
    position: position_schema.nullable().parse(player.position),
    birth_year: player.birth_year,
    season_goals: player.season_goals,
    goals_last_5: player.goals_last_5,
  };
}

export class TeamsService {
  constructor(private readonly teams_repository: TeamsRepository) {}

  /** The sport's teams in Finnish alphabetical order (Ä and Ö after Z). */
  async list_teams(sport: Sport): Promise<TeamSummary[]> {
    const teams = await this.teams_repository.list_teams(sport);
    return [...teams]
      .sort((first, second) => first.name.localeCompare(second.name, "fi"))
      .map(to_team_summary);
  }

  /** The team's roster, sorted by position then jersey, with goal counts for the scorer pick. */
  async list_players(team_id: string): Promise<PlayerSummary[]> {
    const team = await this.teams_repository.find_team(team_id);
    if (!team) {
      throw team_not_found(team_id);
    }
    const season =
      (await this.teams_repository.find_current_season(to_sport(team.sport))) ??
      season_config.season;
    const players = await this.teams_repository.list_players(team_id, season);
    return [...players].sort(compare_roster_order).map(to_player_summary);
  }
}
