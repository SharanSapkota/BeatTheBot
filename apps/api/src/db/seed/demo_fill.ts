import type { EndedIn } from "@voita_kone/prediction_model";

// Demo games fill gaps in the real Liiga data, so the game day hub always has one game
// in each state (upcoming, live, final) to show. They use real teams and players and
// are stored with data_source = 'demo'.

export type HubState = "upcoming" | "live" | "final";

export interface FillTeam {
  id: string;
  name: string;
  /** Forward player ids, best first. The first two score the scripted goals. */
  forward_ids: readonly string[];
}

export interface FillInput {
  now: Date;
  season: string;
  teams: readonly FillTeam[];
  /** States that already have a real game today. */
  todays_states: ReadonlySet<HubState>;
  /** Teams that already play today, so they don't get a second game. */
  busy_team_ids: ReadonlySet<string>;
}

export interface DemoGameRow {
  external_id: string;
  season: string;
  home_team_id: string;
  away_team_id: string;
  start_time: Date;
  status: "scheduled" | "live" | "final";
  home_goals: number | null;
  away_goals: number | null;
  ended_in: EndedIn | null;
  period: number | null;
  game_clock_seconds: number | null;
}

export interface DemoEventRow {
  game_external_id: string;
  period: number;
  game_time_seconds: number;
  team_id: string;
  player_id: string;
  assist_player_ids: string[];
}

export interface DemoFill {
  games: DemoGameRow[];
  events: DemoEventRow[];
  /** States still missing because there were not enough free teams. */
  unfilled_states: HubState[];
}

/** Kaleva is an Oulu paper, so Kärpät gets the first demo game when it is free. */
export const FEATURED_TEAM_NAME = "Kärpät";
const HUB_STATES: readonly HubState[] = ["final", "live", "upcoming"];
const MINUTE_MS = 60 * 1000;
const START_OFFSET_MINUTES: Record<HubState, number> = { final: -180, live: -60, upcoming: 120 };
const STATUS_BY_STATE = { final: "final", live: "live", upcoming: "scheduled" } as const;
// The live demo game is in the 2nd period at 12:41.
const LIVE_PERIOD = 2;
const LIVE_CLOCK_SECONDS = 1961;
const FINAL_PERIOD = 3;

type Side = "home" | "away";
interface ScriptedGoal {
  period: number;
  clock: string;
  side: Side;
  scorer: number;
  assists: number[];
}

// Indexes point into each team's forward_ids.
const SCRIPTED_GOALS: Record<Exclude<HubState, "upcoming">, readonly ScriptedGoal[]> = {
  // Home wins 3-1 in regulation.
  final: [
    { period: 1, clock: "14:37", side: "home", scorer: 0, assists: [1] },
    { period: 2, clock: "05:12", side: "away", scorer: 0, assists: [1] },
    { period: 2, clock: "13:50", side: "home", scorer: 1, assists: [0] },
    { period: 3, clock: "11:03", side: "home", scorer: 0, assists: [] },
  ],
  // 1-1 during the second period.
  live: [
    { period: 1, clock: "08:21", side: "away", scorer: 0, assists: [1] },
    { period: 2, clock: "03:40", side: "home", scorer: 0, assists: [1] },
  ],
};

/** Period and in-period clock ("14:37") to seconds since the game started. */
export function to_game_time_seconds(period: number, clock: string): number {
  const [minutes = 0, seconds = 0] = clock.split(":").map(Number);
  return (period - 1) * 20 * 60 + minutes * 60 + seconds;
}

/** Start time relative to now, rounded down to 5 minutes like a real schedule. */
function demo_start_time(now: Date, state: HubState): Date {
  const start_ms = now.getTime() + START_OFFSET_MINUTES[state] * MINUTE_MS;
  const five_minutes_ms = 5 * MINUTE_MS;
  return new Date(Math.floor(start_ms / five_minutes_ms) * five_minutes_ms);
}

function order_candidates(input: FillInput): FillTeam[] {
  return input.teams
    .filter((team) => team.forward_ids.length >= 2 && !input.busy_team_ids.has(team.id))
    .sort((first, second) => {
      const first_featured = first.name === FEATURED_TEAM_NAME ? 0 : 1;
      const second_featured = second.name === FEATURED_TEAM_NAME ? 0 : 1;
      return first_featured - second_featured || first.name.localeCompare(second.name, "fi");
    });
}

function build_events(
  state: HubState,
  game_external_id: string,
  teams: Record<Side, FillTeam>,
): DemoEventRow[] {
  if (state === "upcoming") {
    return [];
  }
  const forward = (side: Side, index: number) => teams[side].forward_ids[index] ?? "";
  return SCRIPTED_GOALS[state].map((goal) => ({
    game_external_id,
    period: goal.period,
    game_time_seconds: to_game_time_seconds(goal.period, goal.clock),
    team_id: teams[goal.side].id,
    player_id: forward(goal.side, goal.scorer),
    assist_player_ids: goal.assists.map((index) => forward(goal.side, index)),
  }));
}

function build_game(
  state: HubState,
  input: FillInput,
  teams: Record<Side, FillTeam>,
  events: readonly DemoEventRow[],
): DemoGameRow {
  const goals_for = (side: Side) =>
    events.filter((event) => event.team_id === teams[side].id).length;
  const has_score = state !== "upcoming";
  return {
    external_id: `demo_${state}`,
    season: input.season,
    home_team_id: teams.home.id,
    away_team_id: teams.away.id,
    start_time: demo_start_time(input.now, state),
    status: STATUS_BY_STATE[state],
    home_goals: has_score ? goals_for("home") : null,
    away_goals: has_score ? goals_for("away") : null,
    ended_in: state === "final" ? "regulation" : null,
    period: state === "final" ? FINAL_PERIOD : state === "live" ? LIVE_PERIOD : null,
    game_clock_seconds: state === "live" ? LIVE_CLOCK_SECONDS : null,
  };
}

export function build_demo_fill(input: FillInput): DemoFill {
  const candidates = order_candidates(input);
  const fill: DemoFill = { games: [], events: [], unfilled_states: [] };

  for (const state of HUB_STATES.filter((hub_state) => !input.todays_states.has(hub_state))) {
    const [home, away] = candidates.splice(0, 2);
    if (!home || !away) {
      fill.unfilled_states.push(state);
      continue;
    }
    const teams = { home, away };
    const events = build_events(state, `demo_${state}`, teams);
    fill.games.push(build_game(state, input, teams, events));
    fill.events.push(...events);
  }
  return fill;
}
