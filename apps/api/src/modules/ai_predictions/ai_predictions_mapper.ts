import {
  build_win_chance_timeline,
  model_config,
  type GamePrediction,
  type LiveModel,
  type ModelPlayer,
  type Reason,
  type TeamOdds,
  type TimelineGoal,
} from "@voita_kone/prediction_model";
import {
  stake_schema,
  type Crowd,
  type DataSays,
  type GameDetail,
  type SeasonOdds,
  type WinChance,
} from "@voita_kone/shared_types";
import { z } from "zod";
import type { Json } from "../../db/database_types";
import { to_team_summary } from "../teams/teams_mapper";
import type {
  CrowdCounts,
  NewPrediction,
  NewTeamOdds,
  ScorerRow,
  SeasonOddsRows,
  StoredPredictionRow,
} from "./ai_predictions_repository";

/** Shown with the model's numbers: neutral info, not a pick (editorial rule 4: label it). */
export const DATA_SAYS_LABEL = "Data says · calculated from Liiga data";

const SHOOTOUT_PERIOD = 5;

const stored_stakes_schema = z.object({ highlights: z.array(stake_schema) });

/** The facts stored for a reason (relevance and side kept for audits, not sent to the app). */
function to_stored_reason(reason: Reason): Json {
  return {
    fact_id: reason.fact_id,
    type: reason.type,
    team_id: reason.team_id,
    values: reason.values,
    text_en: reason.text_en,
    relevance: reason.relevance,
    favours_team_id: reason.favours_team_id,
  };
}

export function to_new_prediction(prediction: GamePrediction): NewPrediction {
  const { scorer } = prediction;
  return {
    game_id: prediction.game_id,
    predicted_winner_team_id: prediction.predicted_winner_team_id,
    home_win_probability: prediction.home_win_probability,
    away_win_probability: prediction.away_win_probability,
    overtime_probability: prediction.overtime_probability,
    predicted_home_goals: prediction.predicted_home_goals,
    predicted_away_goals: prediction.predicted_away_goals,
    expected_home_goals: prediction.expected_goals.home,
    expected_away_goals: prediction.expected_goals.away,
    overtime_home_share: prediction.overtime_home_share,
    predicted_top_scorer_id: scorer?.player_id ?? null,
    predicted_top_scorer_form: scorer
      ? {
          recent_goals: scorer.recent_goals,
          recent_games: scorer.recent_games,
          season_goals: scorer.season_goals,
        }
      : null,
    reasons: prediction.reasons.map(to_stored_reason),
    stakes: {
      highlights: prediction.stakes.highlights.map((stake) => ({ ...stake })),
      all: prediction.stakes.all.map((stake) => ({ ...stake })),
    },
  };
}

function to_scorer_row(
  players: readonly ModelPlayer[],
  player_id: string | null,
): ScorerRow | null {
  const player = players.find((candidate) => candidate.id === player_id);
  return player
    ? {
        id: player.id,
        team_id: player.team_id,
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number,
      }
    : null;
}

/** A freshly computed prediction in the stored shape (used by the demo replay). */
export function to_stored_prediction(
  prediction: GamePrediction,
  players: readonly ModelPlayer[],
  calculated_at: Date,
): StoredPredictionRow {
  const row = to_new_prediction(prediction);
  return {
    ...row,
    scorer_form: row.predicted_top_scorer_form,
    scorer: to_scorer_row(players, row.predicted_top_scorer_id),
    model_version: model_config.model_version,
    calculated_at,
  };
}

export function to_crowd(counts: CrowdCounts): Crowd | null {
  if (counts.total_picks === 0) {
    return null;
  }
  return {
    total_picks: counts.total_picks,
    home_picks: counts.home_picks,
    away_picks: counts.total_picks - counts.home_picks - counts.draw_picks,
    draw_picks: counts.draw_picks,
    home_pick_share: counts.home_picks / counts.total_picks,
  };
}

export function to_data_says(row: StoredPredictionRow, crowd: Crowd | null): DataSays {
  return {
    game_id: row.game_id,
    home_win_probability: row.home_win_probability,
    away_win_probability: row.away_win_probability,
    overtime_probability: row.overtime_probability,
    stakes: stored_stakes_schema.parse(row.stakes).highlights,
    crowd,
    label_text: DATA_SAYS_LABEL,
    model_version: row.model_version,
    calculated_at: row.calculated_at.toISOString(),
  };
}

export function to_live_model(row: StoredPredictionRow): LiveModel {
  return {
    expected_goals: { home: row.expected_home_goals, away: row.expected_away_goals },
    overtime_home_share: row.overtime_home_share,
  };
}

function timeline_goals(game: GameDetail): TimelineGoal[] {
  return game.events
    .filter((event) => event.event_type === "goal" && event.period < SHOOTOUT_PERIOD)
    .map((event) => ({
      game_time_seconds: event.game_time_seconds,
      side: event.team_id === game.home_team.id ? "home" : "away",
    }));
}

/** Win chance timeline for a live or final game (the caller rejects upcoming games). */
export function to_win_chance(
  game: GameDetail,
  live_model: LiveModel,
  model_version: string,
  updated_at: Date,
): WinChance {
  const goals = timeline_goals(game);
  const is_final = game.state === "final";
  const home_won = (game.home_goals ?? 0) > (game.away_goals ?? 0);
  const points = build_win_chance_timeline({
    model: live_model,
    goals,
    now_seconds: is_final
      ? undefined
      : (game.game_clock_seconds ?? goals.at(-1)?.game_time_seconds ?? 0),
    final_winner: is_final ? (home_won ? "home" : "away") : undefined,
  });
  return {
    game_id: game.id,
    state: game.state,
    points,
    model_version,
    updated_at: updated_at.toISOString(),
  };
}

export function to_new_team_odds(odds: readonly TeamOdds[]): NewTeamOdds[] {
  return odds.map((row) => ({
    team_id: row.team_id,
    playoff_probability: row.playoff_probability,
    top_spots_probability: row.top_spots_probability,
    relegation_probability: row.relegation_probability,
    expected_points: row.expected_points,
  }));
}

/** Most expected final points first (the simulated table), then playoff odds, then name. */
export function to_season_odds(rows: SeasonOddsRows): SeasonOdds {
  return {
    season: rows.season,
    model_version: rows.model_version,
    simulations: rows.simulations,
    calculated_at: rows.run_at.toISOString(),
    rows: rows.rows
      .map((row) => ({
        team: to_team_summary(row.team),
        playoff_probability: row.playoff_probability,
        top_4_probability: row.top_spots_probability,
        relegation_probability: row.relegation_probability,
        expected_points: row.expected_points,
      }))
      .sort(
        (first, second) =>
          second.expected_points - first.expected_points ||
          second.playoff_probability - first.playoff_probability ||
          first.relegation_probability - second.relegation_probability ||
          first.team.name.localeCompare(second.team.name, "fi"),
      ),
  };
}
