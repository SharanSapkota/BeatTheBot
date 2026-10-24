import type { FanPoll, GameDetail } from "@voita_kone/shared_types";
import { is_design_demo, scorer_names } from "./sample_utils";

const SHARES = [0.46, 0.38, 0.16];

// TODO(step 6): replace with GET /api/v1/games/:game_id/questions?phase=live (fan poll).
export function build_sample_fan_poll(game: GameDetail): FanPoll {
  const labels = is_design_demo(game)
    ? ["Eetu Laine", "Aleksi Mäkelä", "Goalie, Ilves"]
    : [...scorer_names(game).slice(0, 2), `Goalie, ${game.away_team.name}`];
  const shares = labels.length === SHARES.length ? SHARES : [0.62, 0.38];
  return {
    question: "Best player so far",
    options: labels.map((label, index) => ({ label, share: shares[index] ?? 0 })),
  };
}
