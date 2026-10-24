import type { GameDetail, GameEvent, ReplayMoment, Sport } from "@voita_kone/shared_types";
import { SPORTS } from "@voita_kone/scoring";

// Replays one finished game at a chosen moment, so the demo never depends on match times.

const OVERTIME_SECONDS = 5 * 60;
/** "Live" per sport: hockey 2nd period 12:41, football 62', basketball 3rd quarter 5:00. */
export const LIVE_TARGET_SECONDS: Readonly<Record<Sport, number>> = {
  hockey: 20 * 60 + 12 * 60 + 41,
  football: 62 * 60,
  basketball: 2 * 10 * 60 + 5 * 60,
};

function goals_of(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((event) => event.event_type === "goal");
}

/**
 * The game time to stop at for "live": the sport's live target, or, if a team has not scored
 * yet by then, the first moment when both teams have at least one goal.
 */
export function choose_live_cut(detail: GameDetail): number {
  const target = LIVE_TARGET_SECONDS[detail.sport];
  const goals = goals_of(detail.events);
  const first_goal_time = (team_id: string) =>
    goals.find((goal) => goal.team_id === team_id)?.game_time_seconds;
  const home_first = first_goal_time(detail.home_team.id);
  const away_first = first_goal_time(detail.away_team.id);
  if (home_first === undefined || away_first === undefined) {
    return target;
  }
  return Math.max(target, home_first, away_first);
}

/**
 * The period a game-time second falls in. Hockey: 1-3, 4 overtime, 5 shootout. Football: 1-2.
 * Basketball: 1-4, 5 overtime.
 */
export function period_at(game_time_seconds: number, sport: Sport = "hockey"): number {
  const { regulation_periods, period_seconds } = SPORTS[sport];
  const regulation_end = regulation_periods * period_seconds;
  if (game_time_seconds < regulation_end) {
    return Math.floor(game_time_seconds / period_seconds) + 1;
  }
  if (sport === "football") {
    return regulation_periods;
  }
  return game_time_seconds < regulation_end + OVERTIME_SECONDS
    ? regulation_periods + 1
    : regulation_periods + 2;
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
    top_scorer: null,
    demo_replay: true,
  };
}

/**
 * The score at the cut. From the goal events when there are any; a game without them
 * (basketball, or a source with no events) gets the final score scaled to the time played.
 */
function score_at(detail: GameDetail, events: readonly GameEvent[], cut_seconds: number) {
  const goals = goals_of(events);
  if (goals_of(detail.events).length > 0) {
    return {
      home: goals.filter((goal) => goal.team_id === detail.home_team.id).length,
      away: goals.filter((goal) => goal.team_id === detail.away_team.id).length,
    };
  }
  const { regulation_periods, period_seconds } = SPORTS[detail.sport];
  const share = Math.min(1, cut_seconds / (regulation_periods * period_seconds));
  return {
    home: Math.round((detail.home_goals ?? 0) * share),
    away: Math.round((detail.away_goals ?? 0) * share),
  };
}

function replay_live(detail: GameDetail, cut_seconds: number): GameDetail {
  const events = detail.events.filter((event) => event.game_time_seconds <= cut_seconds);
  const score = score_at(detail, events, cut_seconds);
  return {
    ...detail,
    state: "live",
    period: period_at(cut_seconds, detail.sport),
    game_clock_seconds: cut_seconds,
    home_goals: score.home,
    away_goals: score.away,
    ended_in: null,
    events,
    top_scorer: null,
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
