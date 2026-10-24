import type { Question } from "@voita_kone/shared_types";

/** A question as the API sends it; tests change only what they need. */
export function make_question(change: Partial<Question> & Pick<Question, "id">): Question {
  return {
    game_id: "00000000-0000-4000-8000-000000000001",
    phase: "after",
    question_type: "result_quiz",
    prompt: change.id,
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    points: 2,
    target: null,
    opens_at: "2026-10-24T19:00:00.000Z",
    locks_at: "2026-10-31T19:00:00.000Z",
    is_locked: false,
    correct_option: "a",
    explanation: { right: "Correct!", wrong: "Not this time." },
    my_answer: null,
    shares: null,
    ...change,
  };
}
