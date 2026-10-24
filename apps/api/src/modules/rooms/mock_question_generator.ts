import type { RoomTopic } from "@voita_kone/shared_types";
import { z } from "zod";
import basketball from "./mock_questions/basketball.json";
import football from "./mock_questions/football.json";
import general_sports from "./mock_questions/general_sports.json";
import hockey from "./mock_questions/hockey.json";
import type { GeneratedQuestion, QuestionGenerator, QuestionRequest } from "./question_generator";
import { pick_bank_question, to_question_draft, type BankQuestion } from "./question_picker";

// Room questions from the JSON banks in mock_questions/ (at least 40 per topic). Simple,
// well-known facts only; when a fact is not certain the question is an opinion question.
// No politics or elections in room questions.

const bank_question_schema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("trivia"),
      prompt: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(4),
      correct: z.number().int().min(0),
    }),
    z.object({
      type: z.literal("opinion"),
      prompt: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(4),
    }),
  ])
  .refine((question) => question.type === "opinion" || question.correct < question.options.length, {
    message: "correct must point to an option",
  })
  .transform((question): BankQuestion => ({
    question_type: question.type,
    prompt: question.prompt,
    options: question.options,
    correct_index: question.type === "trivia" ? question.correct : null,
  }));

/** Parses a bank file; throws on a malformed question (caught by the tests). */
export function parse_bank(raw: unknown): BankQuestion[] {
  return z.array(bank_question_schema).parse(raw);
}

export const MOCK_BANKS: Readonly<Record<RoomTopic, readonly BankQuestion[]>> = {
  hockey: parse_bank(hockey),
  football: parse_bank(football),
  basketball: parse_bank(basketball),
  general_sports: parse_bank(general_sports),
};

export class MockQuestionGenerator implements QuestionGenerator {
  constructor(
    private readonly banks: Readonly<Record<RoomTopic, readonly BankQuestion[]>> = MOCK_BANKS,
  ) {}

  generate(request: QuestionRequest): Promise<GeneratedQuestion> {
    const question = pick_bank_question(
      this.banks[request.topic],
      request.used_prompts,
      request.seed,
    );
    return Promise.resolve({ ...to_question_draft(question, request.seed), source: "mock" });
  }
}
