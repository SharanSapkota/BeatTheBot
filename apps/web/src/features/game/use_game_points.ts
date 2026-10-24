import type { GameDetail } from "@voita_kone/shared_types";
import { useGamePicks } from "../../lib/picks";
import { compute_game_points, type GamePoints } from "../../lib/points";
import { useResultQuiz } from "../after_game/api";
import { to_ai_pick, useAiPrediction } from "./api";

/** The user's points for one game from their stored picks; the same numbers on every screen. */
export function useGamePoints(game: GameDetail): GamePoints {
  const [picks] = useGamePicks(game.id);
  const prediction = useAiPrediction(game);
  const quiz = useResultQuiz(game);
  return compute_game_points({
    picks,
    game,
    ai_pick: to_ai_pick(prediction.data),
    quiz: quiz.data ?? null,
  });
}
