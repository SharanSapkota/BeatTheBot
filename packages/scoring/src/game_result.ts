// The facts of a game that scoring needs, independent of how the API or the app stores them.

export type EndedIn = "regulation" | "overtime" | "shootout";

export interface ResultGoal {
  team_id: string | null;
  player_id: string | null;
  /** 1–3 regulation, 4 overtime, 5 shootout (the shootout winner is not a real goal). */
  period: number;
}

export interface GameResult {
  home_team_id: string;
  away_team_id: string;
  home_goals: number;
  away_goals: number;
  ended_in: EndedIn | null;
  /** Goals in time order. May be empty when the source has no events. */
  goals: readonly ResultGoal[];
}

const REGULATION_PERIODS = 3;
const SHOOTOUT_PERIOD = 5;

/** Real goals in time order: shootout goals are left out. */
export function real_goals(result: GameResult): ResultGoal[] {
  return result.goals.filter((goal) => goal.period < SHOOTOUT_PERIOD);
}

export function winner_team_id(result: GameResult): string | null {
  if (result.home_goals === result.away_goals) {
    return null;
  }
  return result.home_goals > result.away_goals ? result.home_team_id : result.away_team_id;
}

/** "Exact score" means the score after 60 minutes; overtime and shootout goals don't count. */
export function score_after_regulation(result: GameResult): { home: number; away: number } {
  const goals = real_goals(result);
  if (goals.length > 0) {
    const regulation = goals.filter((goal) => goal.period <= REGULATION_PERIODS);
    return {
      home: regulation.filter((goal) => goal.team_id === result.home_team_id).length,
      away: regulation.filter((goal) => goal.team_id === result.away_team_id).length,
    };
  }
  if (result.ended_in === "regulation" || result.ended_in === null) {
    return { home: result.home_goals, away: result.away_goals };
  }
  // Without events: the winner scored the deciding goal after 60 minutes.
  return result.home_goals > result.away_goals
    ? { home: result.home_goals - 1, away: result.away_goals }
    : { home: result.home_goals, away: result.away_goals - 1 };
}

/** True when the player scored a real goal (shootout goals don't count). */
export function has_scored(result: GameResult, player_id: string | null): boolean {
  return player_id !== null && real_goals(result).some((goal) => goal.player_id === player_id);
}
