import {
  players_response_schema,
  type AiPrediction,
  type GameSummary,
  type PlayerSummary,
  type PredictedScorer,
} from "@voita_kone/shared_types";
import { api_get } from "../lib/api_client";
import { is_design_demo, minutes_after_start, round_to, seeded_fraction } from "./sample_utils";

/** model_version of sample data; the AI card says "sample data" when it sees it. */
export const SAMPLE_MODEL_VERSION = "sample";

const DESIGN_REASONS = [
  "Kärpät won 4 of their last 5 home games.",
  "Ilves have scored 2.1 goals per game away, below their home average of 3.0.",
  "Kärpät's top scorer has 5 goals in his last 4 games.",
];

async function top_scorer(team_id: string): Promise<PredictedScorer | null> {
  try {
    const { data } = await api_get(`/teams/${team_id}/players`, players_response_schema);
    const best = [...data].sort(
      (first: PlayerSummary, second: PlayerSummary) =>
        second.goals_last_5 - first.goals_last_5 || second.season_goals - first.season_goals,
    )[0];
    return best
      ? {
          id: best.id,
          team_id,
          first_name: best.first_name,
          last_name: best.last_name,
          jersey_number: best.jersey_number,
          recent_goals: best.goals_last_5,
          recent_games: 5,
          season_goals: best.season_goals,
        }
      : null;
  } catch {
    return null;
  }
}

function sample_reason(index: number, text: string) {
  return { fact_id: `sample_${String(index + 1)}`, type: "sample", values: {}, text_en: text };
}

// Only used when GET /games/:game_id/ai_prediction fails (see get_or_sample).
export async function build_sample_ai_prediction(game: GameSummary): Promise<AiPrediction> {
  const design = is_design_demo(game);
  const seed = seeded_fraction(game.id);
  // Home advantage plus a stable spread: 45%-67% for the home team.
  const home_win_probability = design ? 0.62 : round_to(0.45 + seed * 0.22, 0.01);
  const home_favoured = home_win_probability >= 0.5;
  const winner = home_favoured ? game.home_team : game.away_team;
  const loser = home_favoured ? game.away_team : game.home_team;
  const reasons = design
    ? DESIGN_REASONS
    : [
        `${winner.name} have the better form over their last 5 games.`,
        `${loser.name} have let in more goals per game this season.`,
        `${game.home_team.name} play at home, where Liiga teams win more often.`,
      ];

  return {
    game_id: game.id,
    predicted_winner_team_id: winner.id,
    home_win_probability,
    away_win_probability: round_to(1 - home_win_probability, 0.01),
    overtime_probability: 0.2,
    predicted_home_goals: home_favoured ? 2 : 1,
    predicted_away_goals: home_favoured ? 1 : 2,
    predicted_scorer: await top_scorer(winner.id),
    reasons: reasons.map((text, index) => sample_reason(index, text)),
    stakes: [
      {
        team_id: game.home_team.id,
        kind: "relegation",
        if_win: design ? 0.27 : round_to(0.1 + seed * 0.2, 0.01),
        if_loss: design ? 0.4 : round_to(0.2 + seed * 0.25, 0.01),
      },
      {
        team_id: game.away_team.id,
        kind: "top_4",
        if_win: design ? 0.48 : round_to(0.3 + seed * 0.3, 0.01),
        if_loss: design ? 0.35 : round_to(0.15 + seed * 0.25, 0.01),
      },
    ],
    crowd: {
      home_pick_share: design ? 0.71 : round_to(0.4 + seed * 0.4, 0.01),
      total_picks: design ? 3812 : Math.round(1200 + seed * 2800),
    },
    label_text: "AI's pick, calculated from game statistics",
    model_version: SAMPLE_MODEL_VERSION,
    calculated_at: minutes_after_start(game, -145),
  };
}
