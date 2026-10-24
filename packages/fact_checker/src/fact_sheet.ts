// The verified facts for one game, built by code from Liiga data and model output.
// The LLM may only write about these facts; check_claims compares its text with them.

export type FactSource = "liiga_api" | "derived" | `prediction_model:${string}`;
export type StakeKind = "playoffs" | "top_4" | "relegation";
export type EndedIn = "regulation" | "overtime" | "shootout";

export interface FinalScoreFact {
  fact_id: string;
  type: "final_score";
  value: {
    home_team: string;
    away_team: string;
    home_goals: number;
    away_goals: number;
    ended_in: EndedIn;
    /** Helsinki date of the game, YYYY-MM-DD. */
    date: string;
  };
  source: FactSource;
}

export interface GoalFact {
  fact_id: string;
  type: "goal";
  value: {
    player: string;
    team: string;
    period: number;
    /** Game clock from the start of the game, "51:03". */
    game_time: string;
    score_after: { home: number; away: number };
  };
  source: FactSource;
}

export interface StandingFact {
  fact_id: string;
  type: "standing";
  value: {
    team: string;
    rank_before: number;
    rank_after: number;
    points_before: number;
    points_after: number;
  };
  source: FactSource;
}

export interface SeasonOddsFact {
  fact_id: string;
  type: "season_odds";
  value: { team: string; kind: StakeKind; before: number; after: number };
  source: FactSource;
}

export interface NextGameFact {
  fact_id: string;
  type: "next_game";
  value: {
    team: string;
    opponent: string;
    venue: "home" | "away";
    /** Helsinki date, YYYY-MM-DD. */
    date: string;
    /** English weekday of `date`, e.g. "Saturday". */
    weekday: string;
  };
  source: FactSource;
}

export type Fact = FinalScoreFact | GoalFact | StandingFact | SeasonOddsFact | NextGameFact;

export interface FactSheet {
  game_id: string;
  built_at: string;
  facts: Fact[];
}

/** A real Liiga team or player. A name that is not in the fact sheet fails the check. */
export interface KnownName {
  name: string;
  kind: "team" | "player";
  /** Other forms, e.g. "Oulun Kärpät" or the Finnish "Kärppien". */
  aliases?: readonly string[];
}
