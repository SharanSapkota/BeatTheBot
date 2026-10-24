import type { GameDetail } from "@voita_kone/shared_types";
import { useGamePicks } from "../../lib/picks";
import { compute_game_points, type GamePoints } from "../../lib/points";
import { useCrowd } from "./api";
import { useQuestions } from "./questions_api";

/** The user's points for one game from their stored picks; the same numbers on every screen. */
export function useGamePoints(game: GameDetail): GamePoints {
  const [picks] = useGamePicks(game);
  const crowd = useCrowd(game.id);
  const after = useQuestions(game, "after", game.state === "final");
  return compute_game_points({
    picks,
    game,
    crowd: crowd.data ?? null,
    quiz: (after.data ?? []).filter((question) => question.question_type === "result_quiz"),
  });
}
