import type { RoomOption, RoomQuestionType } from "@voita_kone/shared_types";
import { ROOM_POINTS } from "@voita_kone/scoring";
import { order_candidates } from "../elections/candidate_order";

// Picks the next question from a bank: never a repeat inside a room until every question has
// been used, then the least used ones again. Pure and seeded (room id + slot), so the same slot
// always gets the same question and option order.

export interface BankQuestion {
  question_type: RoomQuestionType;
  prompt: string;
  /** 2–4 labels. */
  options: readonly string[];
  /** Index into options; null for opinion questions. */
  correct_index: number | null;
}

/** A question ready to save in a room. */
export interface RoomQuestionDraft {
  question_type: RoomQuestionType;
  prompt: string;
  /** Shown order; ids a, b, c, d follow the bank order. */
  options: RoomOption[];
  correct_option: string | null;
  points: number;
}

const OPTION_IDS = ["a", "b", "c", "d"] as const;

/** The least used questions (by prompt) in this room, then one of them by the seed. */
export function pick_bank_question(
  bank: readonly BankQuestion[],
  used_prompts: readonly string[],
  seed: string,
): BankQuestion {
  if (bank.length === 0) {
    throw new Error("The question bank is empty");
  }
  const use_counts = new Map<string, number>();
  for (const prompt of used_prompts) {
    use_counts.set(prompt, (use_counts.get(prompt) ?? 0) + 1);
  }
  const fewest_uses = Math.min(...bank.map((question) => use_counts.get(question.prompt) ?? 0));
  const candidates = bank.filter(
    (question) => (use_counts.get(question.prompt) ?? 0) === fewest_uses,
  );
  return order_candidates(candidates, seed)[0] as BankQuestion;
}

/** Option ids by bank order, shown in a seeded order (the right answer isn't always first). */
export function to_question_draft(question: BankQuestion, seed: string): RoomQuestionDraft {
  const options = question.options.map((label, index) => ({
    id: OPTION_IDS[index] ?? String(index),
    label,
  }));
  const correct_option =
    question.correct_index === null ? null : (options[question.correct_index]?.id ?? null);
  return {
    question_type: question.question_type,
    prompt: question.prompt,
    options: order_candidates(options, `${seed}:options`),
    correct_option,
    points:
      question.question_type === "trivia"
        ? ROOM_POINTS.trivia_correct
        : ROOM_POINTS.opinion_answered,
  };
}
