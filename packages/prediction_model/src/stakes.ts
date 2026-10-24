import type { ScheduledGame, Side } from "./model_types";
import { simulate_season, type SimulationInput, type TeamOdds } from "./season_simulation";

export type StakeKind = "playoffs" | "top_4" | "relegation";

export interface Stake {
  team_id: string;
  kind: StakeKind;
  /** The team's probability if it wins this game, and if it loses. */
  if_win: number;
  if_loss: number;
}

export interface GameStakes {
  /** Every kind for both teams (home first). */
  all: Stake[];
  /** The most interesting stake per team (biggest change), the bigger one first. */
  highlights: Stake[];
}

const KIND_FIELDS: Record<StakeKind, keyof Omit<TeamOdds, "team_id" | "expected_points">> = {
  playoffs: "playoff_probability",
  top_4: "top_spots_probability",
  relegation: "relegation_probability",
};

export function swing(stake: Stake): number {
  return Math.abs(stake.if_win - stake.if_loss);
}

function odds_of(odds: readonly TeamOdds[], team_id: string): TeamOdds {
  const team_odds = odds.find((row) => row.team_id === team_id);
  if (!team_odds) {
    throw new Error(`No odds for team ${team_id}`);
  }
  return team_odds;
}

function team_stakes(
  team_id: string,
  if_win: readonly TeamOdds[],
  if_loss: readonly TeamOdds[],
): Stake[] {
  return (Object.keys(KIND_FIELDS) as StakeKind[]).map((kind) => ({
    team_id,
    kind,
    if_win: odds_of(if_win, team_id)[KIND_FIELDS[kind]],
    if_loss: odds_of(if_loss, team_id)[KIND_FIELDS[kind]],
  }));
}

function biggest_swing(stakes: readonly Stake[]): Stake | undefined {
  return [...stakes].sort((first, second) => swing(second) - swing(first))[0];
}

/**
 * What one game means for the season: the same simulation (same seed) run twice, with the
 * game forced to a home win and to an away win. `input.remaining_games` must contain it.
 */
export function compute_stakes(
  input: Omit<SimulationInput, "forced_winners">,
  game: ScheduledGame,
): GameStakes {
  if (!input.remaining_games.some((remaining) => remaining.id === game.id)) {
    throw new Error(`Game ${game.id} is not in the remaining games`);
  }
  const run = (winner: Side) =>
    simulate_season({ ...input, forced_winners: new Map([[game.id, winner]]) });
  const home_wins = run("home");
  const away_wins = run("away");

  const home = team_stakes(game.home_team_id, home_wins, away_wins);
  const away = team_stakes(game.away_team_id, away_wins, home_wins);
  const highlights = [biggest_swing(home), biggest_swing(away)]
    .filter((stake): stake is Stake => stake !== undefined)
    .sort((first, second) => swing(second) - swing(first));
  return { all: [...home, ...away], highlights };
}
