// Room questions (docs/product.md → Rooms). Pure: the API stores the points when the answer is
// saved (one answer per user and question), so scoring again gives the same points.

export const ROOM_POINTS = {
  /** A trivia question answered right. */
  trivia_correct: 3,
  /** An opinion question has no right answer: answering is enough. */
  opinion_answered: 1,
} as const;

export type RoomQuestionType = "trivia" | "opinion";

export interface RoomQuestionToScore {
  question_type: RoomQuestionType;
  /** Null for opinion questions. */
  correct_option: string | null;
}

/** Trivia: 3 for the right option, else 0. Opinion: 1 for any answer. */
export function score_room_answer(question: RoomQuestionToScore, option: string): number {
  if (question.question_type === "opinion") {
    return ROOM_POINTS.opinion_answered;
  }
  return option === question.correct_option ? ROOM_POINTS.trivia_correct : 0;
}
