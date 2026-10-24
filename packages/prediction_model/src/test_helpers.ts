import type { EndedIn } from "./game_points";
import type { PlayedGame, ScheduledGame } from "./model_types";

// Builders for small fake seasons used by the unit tests only.

const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_START = Date.UTC(2026, 8, 1, 15, 30);

export function day(index: number): Date {
  return new Date(SEASON_START + index * DAY_MS);
}

export function played(
  id: string,
  day_index: number,
  home_team_id: string,
  away_team_id: string,
  home_goals: number,
  away_goals: number,
  ended_in: EndedIn = "regulation",
): PlayedGame {
  return {
    id,
    start_time: day(day_index),
    home_team_id,
    away_team_id,
    home_goals,
    away_goals,
    ended_in,
  };
}

export function scheduled(
  id: string,
  day_index: number,
  home_team_id: string,
  away_team_id: string,
): ScheduledGame {
  return { id, start_time: day(day_index), home_team_id, away_team_id };
}

/** Every pair of teams meets home and away once; `result` decides each score. */
export function round_robin(
  team_ids: readonly string[],
  result: (home: string, away: string) => [number, number],
): PlayedGame[] {
  const games: PlayedGame[] = [];
  let day_index = 0;
  for (const home of team_ids) {
    for (const away of team_ids) {
      if (home !== away) {
        const [home_goals, away_goals] = result(home, away);
        const ended_in: EndedIn = home_goals === away_goals ? "overtime" : "regulation";
        const final_home = ended_in === "overtime" ? home_goals + 1 : home_goals;
        games.push(
          played(`${home}_${away}`, day_index, home, away, final_home, away_goals, ended_in),
        );
        day_index += 1;
      }
    }
  }
  return games;
}
