import {
  ended_in_schema,
  type GameDetail,
  type GameEvent,
  type GameState,
  type GameSummary,
  type PlayerRef,
} from "@voita_kone/shared_types";
import { sport_config } from "@voita_kone/scoring";
import { to_data_source, to_sport, to_team_summary } from "../teams/teams_mapper";
import type { EventRow, GameRow, PlayerRefRow } from "./games_repository";

// Liiga regular-season overtime is 5 minutes (3600-3900; the shootout is logged at 3900), and so
// is basketball overtime. Football league games have no extra time.
const OVERTIME_SECONDS = 5 * 60;
const STATE_BY_STATUS: Record<string, GameState> = {
  scheduled: "upcoming",
  live: "live",
  final: "final",
};
const STATE_ORDER: Record<GameState, number> = { live: 0, upcoming: 1, final: 2 };
const EVENT_TYPES = new Set(["goal", "penalty"]);

/** DB status (scheduled / live / final) to the state the app shows. */
export function to_game_state(status: string): GameState {
  const state = STATE_BY_STATUS[status];
  if (!state) {
    throw new Error(`Unknown game status "${status}"`);
  }
  return state;
}

export function is_featured(game: GameRow, featured_team_external_id: string): boolean {
  return (
    game.home_team.external_id === featured_team_external_id ||
    game.away_team.external_id === featured_team_external_id
  );
}

export function to_game_summary(game: GameRow, featured_team_external_id: string): GameSummary {
  return {
    id: game.id,
    sport: to_sport(game.sport),
    league: game.league,
    season: game.season,
    start_time: game.start_time.toISOString(),
    state: to_game_state(game.status),
    period: game.period,
    game_clock_seconds: game.game_clock_seconds,
    home_team: to_team_summary(game.home_team),
    away_team: to_team_summary(game.away_team),
    home_goals: game.home_goals,
    away_goals: game.away_goals,
    ended_in: ended_in_schema.nullable().parse(game.ended_in),
    featured: is_featured(game, featured_team_external_id),
    data_source: to_data_source(game.data_source),
  };
}

/** Live first, then upcoming, then final. Featured games first in each group, then by start. */
export function compare_game_day_order(first: GameSummary, second: GameSummary): number {
  return (
    STATE_ORDER[first.state] - STATE_ORDER[second.state] ||
    Number(second.featured) - Number(first.featured) ||
    first.start_time.localeCompare(second.start_time) ||
    first.home_team.name.localeCompare(second.home_team.name, "fi")
  );
}

export function order_game_day(games: readonly GameSummary[]): GameSummary[] {
  return [...games].sort(compare_game_day_order);
}

function to_player_ref(player: PlayerRefRow): PlayerRef {
  return {
    id: player.id,
    first_name: player.first_name,
    last_name: player.last_name,
    jersey_number: player.jersey_number,
  };
}

/** How many periods have ended: all played periods when final, those before the current one when live. */
function count_ended_periods(game: GameSummary): number {
  const { regulation_periods } = sport_config(game.sport);
  if (game.state === "final") {
    // An overtime game ends on the winning goal (or buzzer), so overtime has no separate "end";
    // a hockey shootout follows a full overtime.
    return game.ended_in === "shootout" ? regulation_periods + 1 : regulation_periods;
  }
  if (game.state === "live" && game.period) {
    return game.period - 1;
  }
  return 0;
}

function period_end_time(game: GameSummary, period: number): number {
  const { regulation_periods, period_seconds } = sport_config(game.sport);
  return period <= regulation_periods
    ? period * period_seconds
    : regulation_periods * period_seconds + OVERTIME_SECONDS;
}

function period_end_events(game: GameSummary): GameEvent[] {
  return Array.from({ length: count_ended_periods(game) }, (_, index) => {
    const period = index + 1;
    return {
      id: `period_end_${String(period)}`,
      event_type: "period_end",
      period,
      game_time_seconds: period_end_time(game, period),
      team_id: null,
      player: null,
      assists: [],
      penalty_minutes: null,
      score_after: null,
    };
  });
}

function to_game_event(event: EventRow): GameEvent {
  if (!EVENT_TYPES.has(event.event_type)) {
    throw new Error(`Unexpected stored event type "${event.event_type}"`);
  }
  return {
    id: event.id,
    event_type: event.event_type as "goal" | "penalty",
    period: event.period,
    game_time_seconds: event.game_time_seconds,
    team_id: event.team_id,
    player: event.player ? to_player_ref(event.player) : null,
    assists: event.assists.map(to_player_ref),
    penalty_minutes: event.event_type === "penalty" ? event.penalty_minutes : null,
    score_after: null,
  };
}

/** Time order; at the same moment, goals and penalties come before the period end. */
function compare_events(first: GameEvent, second: GameEvent): number {
  const end_last = (event: GameEvent) => (event.event_type === "period_end" ? 1 : 0);
  return (
    first.game_time_seconds - second.game_time_seconds ||
    first.period - second.period ||
    end_last(first) - end_last(second)
  );
}

/** Adds the running score after each goal. */
export function with_running_score(game: GameSummary, events: readonly GameEvent[]): GameEvent[] {
  const score = { home: 0, away: 0 };
  return events.map((event) => {
    if (event.event_type !== "goal") {
      return event;
    }
    if (event.team_id === game.home_team.id) {
      score.home += 1;
    } else if (event.team_id === game.away_team.id) {
      score.away += 1;
    }
    return { ...event, score_after: { ...score } };
  });
}

/** Stored events plus derived period ends, in time order, with the running score. */
export function build_game_events(game: GameSummary, rows: readonly EventRow[]): GameEvent[] {
  const events = [...rows.map(to_game_event), ...period_end_events(game)].sort(compare_events);
  return with_running_score(game, events);
}

export function to_game_detail(
  game: GameSummary,
  rows: readonly EventRow[],
  top_scorer: PlayerRefRow | null = null,
): GameDetail {
  return {
    ...game,
    events: build_game_events(game, rows),
    top_scorer: top_scorer && game.state === "final" ? to_player_ref(top_scorer) : null,
    demo_replay: false,
  };
}
