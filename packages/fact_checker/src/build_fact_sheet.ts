import { WEEKDAYS } from "./claims";
import type { EndedIn, Fact, FactSheet, FactSource, StakeKind } from "./fact_sheet";

// Builds the fact sheet of a finished game from data the API has already loaded and computed
// (Liiga data, derived standings, model odds). Pure; never calls the LLM.

export interface FactSheetGoal {
  /** Null when Liiga has no scorer for the goal (it is then left out). */
  player: string | null;
  team: string;
  period: number;
  game_time_seconds: number;
}

export interface FactSheetStanding {
  team: string;
  rank_before: number;
  rank_after: number;
  points_before: number;
  points_after: number;
}

export type OddsByKind = Record<StakeKind, number>;

export interface FactSheetOdds {
  team: string;
  before: OddsByKind;
  after: OddsByKind;
}

export interface FactSheetNextGame {
  team: string;
  opponent: string;
  venue: "home" | "away";
  /** Helsinki date, YYYY-MM-DD. */
  date: string;
}

export interface FactSheetInput {
  game_id: string;
  built_at: string;
  /** Helsinki date of the game, YYYY-MM-DD. */
  date: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  ended_in: EndedIn;
  /** In time order. Shootout goals (period 5) are left out. */
  goals: readonly FactSheetGoal[];
  standings: readonly FactSheetStanding[];
  odds: readonly FactSheetOdds[];
  /** e.g. "prediction_model:poisson_mc_v1". */
  odds_source: FactSource;
  next_games: readonly FactSheetNextGame[];
}

const SHOOTOUT_PERIOD = 5;
const STAKE_KINDS: readonly StakeKind[] = ["relegation", "playoffs", "top_4"];

/** 3063 seconds -> "51:03" (minutes from the start of the game). */
export function format_game_time(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** English weekday of a YYYY-MM-DD date. */
export function weekday_of(date: string): string {
  // Noon UTC is on the same calendar day everywhere.
  const index = new Date(`${date}T12:00:00Z`).getUTCDay();
  return WEEKDAYS[(index + 6) % 7] ?? "";
}

/** The team's stake that the game changed most (relegation first on a tie). */
export function biggest_change(odds: FactSheetOdds): StakeKind {
  let best: StakeKind = "relegation";
  for (const kind of STAKE_KINDS) {
    if (
      Math.abs(odds.after[kind] - odds.before[kind]) >
      Math.abs(odds.after[best] - odds.before[best])
    ) {
      best = kind;
    }
  }
  return best;
}

export function build_fact_sheet(input: FactSheetInput): FactSheet {
  const facts: Fact[] = [];
  const next_id = () => `f${String(facts.length + 1)}`;

  facts.push({
    fact_id: next_id(),
    type: "final_score",
    value: {
      home_team: input.home_team,
      away_team: input.away_team,
      home_goals: input.home_goals,
      away_goals: input.away_goals,
      ended_in: input.ended_in,
      date: input.date,
    },
    source: "liiga_api",
  });

  const score = { home: 0, away: 0 };
  const real_goals = input.goals.filter((candidate) => candidate.period < SHOOTOUT_PERIOD);
  for (const goal of real_goals) {
    if (goal.team === input.home_team) {
      score.home += 1;
    } else {
      score.away += 1;
    }
    if (goal.player === null) {
      continue;
    }
    facts.push({
      fact_id: next_id(),
      type: "goal",
      value: {
        player: goal.player,
        team: goal.team,
        period: goal.period,
        game_time: format_game_time(goal.game_time_seconds),
        score_after: { ...score },
      },
      source: "liiga_api",
    });
  }

  const winning_goal = find_winning_goal(input, real_goals);
  if (winning_goal?.player) {
    facts.push({
      fact_id: next_id(),
      type: "winning_goal",
      value: {
        player: winning_goal.player,
        team: winning_goal.team,
        game_time: format_game_time(winning_goal.game_time_seconds),
      },
      source: "derived",
    });
  }

  for (const standing of input.standings) {
    facts.push({ fact_id: next_id(), type: "standing", value: { ...standing }, source: "derived" });
  }

  for (const odds of input.odds) {
    const kind = biggest_change(odds);
    facts.push({
      fact_id: next_id(),
      type: "season_odds",
      value: { team: odds.team, kind, before: odds.before[kind], after: odds.after[kind] },
      source: input.odds_source,
    });
  }

  for (const next_game of input.next_games) {
    facts.push({
      fact_id: next_id(),
      type: "next_game",
      value: { ...next_game, weekday: weekday_of(next_game.date) },
      source: "liiga_api",
    });
  }

  return { game_id: input.game_id, built_at: input.built_at, facts, kind: "summary" };
}

/**
 * The goal that decided the game: the winner's goal that took it one past the loser's final
 * total. None after a shootout (the shootout decided it) or without goal events.
 */
export function find_winning_goal(
  input: Pick<FactSheetInput, "home_team" | "home_goals" | "away_goals" | "ended_in">,
  real_goals: readonly FactSheetGoal[],
): FactSheetGoal | undefined {
  if (input.ended_in === "shootout" || input.home_goals === input.away_goals) {
    return undefined;
  }
  const home_won = input.home_goals > input.away_goals;
  const loser_total = home_won ? input.away_goals : input.home_goals;
  const winner_goals = real_goals.filter((goal) => (goal.team === input.home_team) === home_won);
  return winner_goals[loser_total];
}
