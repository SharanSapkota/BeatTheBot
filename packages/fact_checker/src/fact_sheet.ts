// The verified facts for one game, built by code from Liiga data and model output.
// The LLM may only write about these facts; check_claims compares its text with them.

/** sample_data = football / basketball sample fixtures (no data API yet; labelled "Sample data"). */
export type FactSource = "liiga_api" | "sample_data" | "derived" | `prediction_model:${string}`;
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

/** Summary: the goal that decided the game (the winner's goal that made it one more than the loser's final total). */
export interface WinningGoalFact {
  fact_id: string;
  type: "winning_goal";
  value: { player: string; team: string; game_time: string };
  source: FactSource;
}

/** Preview: a team's last 5 finished games, oldest first ("WWLWL"). */
export interface FormFact {
  fact_id: string;
  type: "form";
  /** results: "W" / "D" / "L" per game (draws only in football). */
  value: {
    team: string;
    results: string;
    wins: number;
    draws: number;
    losses: number;
    games: number;
  };
  source: FactSource;
}

/** Preview: one earlier meeting of the two teams (any season). */
export interface HeadToHeadFact {
  fact_id: string;
  type: "head_to_head";
  value: {
    home_team: string;
    away_team: string;
    /** Helsinki date, YYYY-MM-DD. */
    date: string;
    home_goals: number;
    away_goals: number;
    ended_in: EndedIn;
  };
  source: FactSource;
}

/** Preview: this season's record at home (home team) or away (away team). */
export interface HomeAwayRecordFact {
  fact_id: string;
  type: "home_away_record";
  value: {
    team: string;
    venue: "home" | "away";
    wins: number;
    draws: number;
    losses: number;
    games: number;
  };
  source: FactSource;
}

/** Preview: the team's top scorer in its last 5 games. */
export interface PlayerFormFact {
  fact_id: string;
  type: "player_form";
  value: { player: string; team: string; goals: number; games: number };
  source: FactSource;
}

/** Preview: the table before the game. */
export interface TablePositionFact {
  fact_id: string;
  type: "table_position";
  value: { team: string; rank: number; points: number; games_played: number };
  source: FactSource;
}

/** Preview: this season's meetings of the two teams so far (wins each, draws). */
export interface SeasonSeriesFact {
  fact_id: string;
  type: "season_series";
  value: {
    home_team: string;
    away_team: string;
    home_team_wins: number;
    away_team_wins: number;
    draws: number;
    games: number;
  };
  source: FactSource;
}

/**
 * Summary: how the lead changed hands. `comeback` = the winner trailed by `from_behind` goals
 * at some point. Only when every goal of the game is known.
 */
export interface LeadChangesFact {
  fact_id: string;
  type: "lead_changes";
  value: {
    lead_changes: number;
    comeback: { team: string; from_behind: number } | null;
  };
  source: FactSource;
}

/** Preview: "Data says" win chance from the prediction model (overtime included). */
export interface WinChanceFact {
  fact_id: string;
  type: "win_chance";
  value: { home_team: string; away_team: string; home_win: number; away_win: number };
  source: FactSource;
}

/** Preview: what is at stake for a team, its odds if it wins vs loses. */
export interface StakeFact {
  fact_id: string;
  type: "stake";
  value: { team: string; kind: StakeKind; if_win: number; if_loss: number };
  source: FactSource;
}

export type Fact =
  | FinalScoreFact
  | GoalFact
  | StandingFact
  | SeasonOddsFact
  | NextGameFact
  | WinningGoalFact
  | FormFact
  | HeadToHeadFact
  | HomeAwayRecordFact
  | PlayerFormFact
  | TablePositionFact
  | SeasonSeriesFact
  | LeadChangesFact
  | WinChanceFact
  | StakeFact;

export type FactSheetKind = "preview" | "summary";

export interface FactSheet {
  game_id: string;
  built_at: string;
  facts: Fact[];
  /** Missing on old sheets: they are summaries. */
  kind?: FactSheetKind;
}

/** A real Liiga team or player. A name that is not in the fact sheet fails the check. */
export interface KnownName {
  name: string;
  kind: "team" | "player";
  /** Other forms, e.g. "Oulun Kärpät" or the Finnish "Kärppien". */
  aliases?: readonly string[];
}
