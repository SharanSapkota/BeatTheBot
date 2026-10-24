import type { GameDetail, GameEvent, ReplayMoment } from "@voita_kone/shared_types";

// Replays one real finished game at a chosen moment, so the demo never depends on match times.

const SECONDS_PER_PERIOD = 20 * 60;
const REGULATION_END_SECONDS = 3 * SECONDS_PER_PERIOD;
const OVERTIME_END_SECONDS = REGULATION_END_SECONDS + 5 * 60;
/** "Live" means 2nd period 12:41 unless a later point gives both teams a goal. */
export const LIVE_TARGET_SECONDS = SECONDS_PER_PERIOD + 12 * 60 + 41;

function goals_of(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((event) => event.event_type === "goal");
}

/**
 * The game time to stop at for "live": 2nd period 12:41, or, if a team has not scored yet
 * by then, the first moment when both teams have at least one goal.
 */
export function choose_live_cut(detail: GameDetail): number {
  const goals = goals_of(detail.events);
  const first_goal_time = (team_id: string) =>
    goals.find((goal) => goal.team_id === team_id)?.game_time_seconds;
  const home_first = first_goal_time(detail.home_team.id);
  const away_first = first_goal_time(detail.away_team.id);
  if (home_first === undefined || away_first === undefined) {
    return LIVE_TARGET_SECONDS;
  }
  return Math.max(LIVE_TARGET_SECONDS, home_first, away_first);
}

/** The period a game-time second falls in (1-3, 4 overtime, 5 shootout). */
export function period_at(game_time_seconds: number): number {
  if (game_time_seconds < REGULATION_END_SECONDS) {
    return Math.floor(game_time_seconds / SECONDS_PER_PERIOD) + 1;
  }
  return game_time_seconds < OVERTIME_END_SECONDS ? 4 : 5;
}

function replay_before(detail: GameDetail): GameDetail {
  return {
    ...detail,
    state: "upcoming",
    period: null,
    game_clock_seconds: null,
    home_goals: null,
    away_goals: null,
    ended_in: null,
    events: [],
    demo_replay: true,
  };
}

function replay_live(detail: GameDetail, cut_seconds: number): GameDetail {
  const events = detail.events.filter((event) => event.game_time_seconds <= cut_seconds);
  const goals = goals_of(events);
  return {
    ...detail,
    state: "live",
    period: period_at(cut_seconds),
    game_clock_seconds: cut_seconds,
    home_goals: goals.filter((goal) => goal.team_id === detail.home_team.id).length,
    away_goals: goals.filter((goal) => goal.team_id === detail.away_team.id).length,
    ended_in: null,
    events,
    demo_replay: true,
  };
}

/**
 * `detail` must be a finished game. "before" hides the result, "live" shows only what had
 * happened by the cut (default: choose_live_cut), "final" shows everything.
 */
export function replay_game(
  detail: GameDetail,
  moment: ReplayMoment,
  live_cut_seconds: number = choose_live_cut(detail),
): GameDetail {
  if (moment === "before") {
    return replay_before(detail);
  }
  if (moment === "live") {
    return replay_live(detail, live_cut_seconds);
  }
  return { ...detail, state: "final", game_clock_seconds: null, demo_replay: true };
}
