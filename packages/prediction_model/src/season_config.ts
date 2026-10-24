// Liiga 2026/27 "superseason" facts. Logic reads these values instead of hardcoding them.
// Table lines come from the Liiga standings endpoint: `playoffsLines: [4, 12, 14]` (2026-27).
// VERIFY with Kaleva / Liiga rules: line 4 = top 4 go straight to the quarter-finals,
// line 12 = top 12 make the playoffs, line 14 = teams below it (15th-17th) are relegated.
export const season_config = {
  season: "2026-27",
  team_count: 17,
  relegated_team_count: 3,
  playoff_spots: 12,
  top_spots: 4,
  points: {
    regulation_win: 3,
    overtime_win: 2,
    overtime_loss: 1,
    regulation_loss: 0,
  },
} as const;

/** The table lines the season simulation counts. */
export interface TableRules {
  playoff_spots: number;
  top_spots: number;
  relegated_team_count: number;
}

export const table_rules: TableRules = {
  playoff_spots: season_config.playoff_spots,
  top_spots: season_config.top_spots,
  relegated_team_count: season_config.relegated_team_count,
};

/** Model parameters. Changing any of them is a new model version. */
export const model_config = {
  model_version: "poisson_mc_v1",
  seed: 2027,
  season_simulations: 10_000,
  stakes_simulations: 5_000,
  /** Weight halves every 10 games back in a team's history. */
  half_life_games: 10,
  /** Shrinks strengths toward the league average: worth this many average games. */
  prior_games: 6,
  /** League goal averages count as this many games of a default league (early season). */
  prior_league_games: 40,
  /** Default goals per game when there is no data yet. VERIFY: Liiga 2025-26 averages. */
  default_home_goals: 3.0,
  default_away_goals: 2.6,
  /** Opponent-adjustment passes in team_strength. */
  strength_iterations: 5,
  /** Goals per team above this are cut off in the Poisson tables (probability ~0). */
  max_goals: 10,
  /** How much of the strength difference carries into overtime (0 = coin flip). */
  overtime_strength_weight: 0.5,
} as const;
