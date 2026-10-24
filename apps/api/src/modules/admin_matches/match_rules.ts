import type { AdminMatchResultInput, Sport } from "@voita_kone/shared_types";
import { SPORTS } from "@voita_kone/scoring";
import { to_helsinki_date } from "../../common/helsinki_date";

// Pure rules for admin-entered matches (football, basketball), tested without a database.

/**
 * The season a match belongs to: football (Veikkausliiga) plays within a calendar year
 * ("2026"); basketball, like hockey, runs autumn to spring ("2026-27", from July on).
 */
export function season_of(sport: Sport, start_time: Date): string {
  const [year_text = "", month_text = ""] = to_helsinki_date(start_time).split("-");
  const year = Number(year_text);
  if (sport === "football") {
    return String(year);
  }
  const first_year = Number(month_text) >= 7 ? year : year - 1;
  return `${String(first_year)}-${String(first_year + 1).slice(2)}`;
}

export interface MatchTeams {
  home_team_id: string;
  away_team_id: string;
}

/** Football goal minute → game-time seconds (one second into the minute, e.g. 62' → 3661). */
export function minute_to_seconds(minute: number): number {
  return (minute - 1) * 60 + 1;
}

/** Football: 1st half up to 45' (stoppage time in the minute 45), then the 2nd half. */
export function half_of(minute: number): number {
  return minute <= 45 ? 1 : 2;
}

/** The period a finished match ended in: the last regulation period, or overtime after it. */
export function final_period(sport: Sport, ended_in: AdminMatchResultInput["ended_in"]): number {
  const { regulation_periods } = SPORTS[sport];
  return ended_in === "overtime" ? regulation_periods + 1 : regulation_periods;
}

/**
 * Why a result does not fit the sport, or null. `player_team` = the team of each named player
 * (undefined for an unknown player).
 */
export function result_rule_error(
  sport: Sport,
  match: MatchTeams,
  result: AdminMatchResultInput,
  player_team: ReadonlyMap<string, string>,
): string | null {
  const is_team = (team_id: string) =>
    team_id === match.home_team_id || team_id === match.away_team_id;
  const is_draw = result.home_goals === result.away_goals;
  if (is_draw && !SPORTS[sport].allows_draw) {
    return `A ${sport} match can't end in a draw`;
  }
  if (sport === "football") {
    if (result.ended_in !== "regulation") {
      return "A league football match has no overtime";
    }
    if (result.top_scorer_player_id !== null) {
      return "Football has no top scorer; list the goals instead";
    }
    if (result.goals.length > 0) {
      const home = result.goals.filter((goal) => goal.team_id === match.home_team_id).length;
      const away = result.goals.filter((goal) => goal.team_id === match.away_team_id).length;
      if (result.goals.some((goal) => !is_team(goal.team_id))) {
        return "Every goal must be scored by one of the two teams";
      }
      if (home !== result.home_goals || away !== result.away_goals) {
        return "The goals must add up to the final score (or leave the scorers empty)";
      }
      const wrong_scorer = result.goals.find(
        (goal) => goal.player_id !== null && player_team.get(goal.player_id) !== goal.team_id,
      );
      if (wrong_scorer) {
        return "A scorer must play for the team that scored";
      }
    }
    return null;
  }
  if (result.goals.length > 0) {
    return "Basketball has no goal list; enter the top scorer instead";
  }
  const top_scorer = result.top_scorer_player_id;
  if (top_scorer !== null && !is_team(player_team.get(top_scorer) ?? "")) {
    return "The top scorer must play for one of the two teams";
  }
  return null;
}
