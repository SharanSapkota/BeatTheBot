import { z } from "zod";
import { api_success_schema } from "./api_response";

// Live picks, result quiz and player vote (step 6). Real games: answers are saved and scored by
// the API. Demo replays: the same questions, built for the replay moment; answers stay on the
// device and never reach the leaderboard.

export const question_type_schema = z.enum([
  "next_goal",
  "period_goal",
  "result_quiz",
  "player_vote",
  "poll",
]);
export const question_phase_schema = z.enum(["live", "after"]);

export const question_option_schema = z.object({
  /** next_goal: home | away | none · period_goal: yes | no · quiz: a–d · vote/poll: player id. */
  id: z.string(),
  label: z.string(),
});

export const question_schema = z.object({
  /** A uuid; demo replay questions use "demo_<game_id>_<key>". */
  id: z.string(),
  game_id: z.uuid(),
  phase: question_phase_schema,
  question_type: question_type_schema,
  prompt: z.string(),
  options: z.array(question_option_schema),
  points: z.number().int().min(0),
  /** next_goal: goals already scored when it opened (predicts goal target + 1). period_goal: the period. */
  target: z.number().int().min(0).nullable(),
  opens_at: z.iso.datetime(),
  locks_at: z.iso.datetime(),
  is_locked: z.boolean(),
  /** Shown once decided and answered (or locked). Null for votes and polls. */
  correct_option: z.string().nullable(),
  /** Quiz feedback for a right and a wrong answer; shown with `correct_option`. */
  explanation: z.object({ right: z.string(), wrong: z.string() }).nullable(),
  /** The signed-in user's answer; always null in demo replays. */
  my_answer: z
    .object({ answer: z.string(), points_awarded: z.number().int().nullable() })
    .nullable(),
  /** Poll and vote: share of all answers per option (0–1). Null for picks and quiz. */
  shares: z.array(z.object({ option_id: z.string(), share: z.number().min(0).max(1) })).nullable(),
});

/** POST /questions/:question_id/answers */
export const answer_request_schema = z.object({ answer: z.string().min(1).max(100) });

export const answer_result_schema = z.object({
  question_id: z.uuid(),
  answer: z.string(),
  /** Null for votes and polls, and for live picks that are not decided yet. */
  correct: z.boolean().nullable(),
  points_awarded: z.number().int().nullable(),
  correct_option: z.string().nullable(),
  explanation: z.string().nullable(),
});

export const questions_response_schema = api_success_schema(z.array(question_schema));
export const answer_result_response_schema = api_success_schema(answer_result_schema);

export type QuestionType = z.infer<typeof question_type_schema>;
export type QuestionPhase = z.infer<typeof question_phase_schema>;
export type QuestionOption = z.infer<typeof question_option_schema>;
export type Question = z.infer<typeof question_schema>;
export type AnswerRequest = z.infer<typeof answer_request_schema>;
export type AnswerResult = z.infer<typeof answer_result_schema>;
