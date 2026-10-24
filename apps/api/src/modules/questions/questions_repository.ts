import type { Fact } from "@voita_kone/fact_checker";
import {
  question_option_schema,
  question_type_schema,
  type QuestionOption,
  type QuestionType,
} from "@voita_kone/shared_types";
import { sql } from "kysely";
import { z } from "zod";
import type { Database } from "../../db/kysely";
import type { QuestionDraft } from "./question_drafts";

/** Question texts are stored per language; the MVP writes English (like the stories). */
export const QUESTION_LANGUAGE = "en";

export type QuestionStatus = "live" | "in_review";

export interface QuestionRow {
  id: string;
  game_id: string;
  phase: "live" | "after";
  question_type: QuestionType;
  question_key: string;
  prompt: string;
  options: QuestionOption[];
  correct_option: string | null;
  explanation: { right: string; wrong: string } | null;
  points: number;
  target: number | null;
  opens_at: Date;
  locks_at: Date;
}

export interface AnswerRow {
  question_id: string;
  answer: string;
  points_awarded: number | null;
}

export interface AnswerCount {
  question_id: string;
  answer: string;
  count: number;
}

export interface NewQuestion {
  draft: QuestionDraft;
  status: QuestionStatus;
}

export interface QuestionsRepository {
  /** Saves new questions; a question that already exists (same game and key) is kept as it is. */
  insert_questions(game_id: string, questions: readonly NewQuestion[]): Promise<void>;
  /** Published questions of one game and phase (questions in review are left out). */
  list_questions(game_id: string, phase: "live" | "after"): Promise<QuestionRow[]>;
  find_question(question_id: string): Promise<QuestionRow | undefined>;
  list_answers(user_id: string, question_ids: readonly string[]): Promise<AnswerRow[]>;
  count_answers(question_ids: readonly string[]): Promise<AnswerCount[]>;
  /** False when the user has already answered. */
  insert_answer(
    user_id: string,
    question_id: string,
    answer: string,
    points_awarded: number | null,
  ): Promise<boolean>;
  /** The facts of the game's latest fact sheet (saved with the "what it means" story). */
  find_latest_facts(game_id: string): Promise<Fact[] | undefined>;
}

const text_by_language_schema = z.record(z.string(), z.string());
const explanation_schema = z
  .record(z.string(), z.object({ right: z.string(), wrong: z.string() }))
  .nullable();
const fact_schema = z.custom<Fact>(
  (value) => typeof value === "object" && value !== null && "fact_id" in value && "type" in value,
);

function to_json(value: unknown): string {
  return JSON.stringify(value);
}

function in_language(texts: Record<string, string>): string {
  return texts[QUESTION_LANGUAGE] ?? Object.values(texts)[0] ?? "";
}

const QUESTION_COLUMNS = [
  "id",
  "game_id",
  "phase",
  "question_type",
  "question_key",
  "prompt",
  "options",
  "correct_option",
  "explanation",
  "points",
  "target",
  "opens_at",
  "locks_at",
] as const;

interface RawQuestion {
  id: string;
  game_id: string | null;
  phase: string;
  question_type: string;
  question_key: string;
  prompt: unknown;
  options: unknown;
  correct_option: string | null;
  explanation: unknown;
  points: number;
  target: number | null;
  opens_at: Date;
  locks_at: Date;
}

function to_question_row(raw: RawQuestion): QuestionRow {
  const explanations = explanation_schema.parse(raw.explanation);
  return {
    id: raw.id,
    game_id: raw.game_id ?? "",
    phase: raw.phase === "after" ? "after" : "live",
    question_type: question_type_schema.parse(raw.question_type),
    question_key: raw.question_key,
    prompt: in_language(text_by_language_schema.parse(raw.prompt)),
    options: z.array(question_option_schema).parse(raw.options),
    correct_option: raw.correct_option,
    explanation: explanations ? (explanations[QUESTION_LANGUAGE] ?? null) : null,
    points: raw.points,
    target: raw.target,
    opens_at: raw.opens_at,
    locks_at: raw.locks_at,
  };
}

export class KyselyQuestionsRepository implements QuestionsRepository {
  constructor(private readonly db: Database) {}

  async insert_questions(game_id: string, questions: readonly NewQuestion[]): Promise<void> {
    if (questions.length === 0) {
      return;
    }
    await this.db
      .insertInto("questions")
      .values(
        questions.map(({ draft, status }) => ({
          game_id,
          phase: draft.phase,
          question_type: draft.question_type,
          question_key: draft.key,
          prompt: to_json({ [QUESTION_LANGUAGE]: draft.prompt }),
          options: to_json(draft.options),
          correct_option: draft.correct_option,
          explanation: draft.explanation
            ? to_json({ [QUESTION_LANGUAGE]: draft.explanation })
            : null,
          points: draft.points,
          target: draft.target,
          fact_ids: to_json(draft.fact_ids),
          opens_at: draft.opens_at,
          locks_at: draft.locks_at,
          status,
        })),
      )
      .onConflict((conflict) => conflict.columns(["game_id", "question_key"]).doNothing())
      .execute();
  }

  async list_questions(game_id: string, phase: "live" | "after"): Promise<QuestionRow[]> {
    const rows = await this.db
      .selectFrom("questions")
      .select(QUESTION_COLUMNS)
      .where("game_id", "=", game_id)
      .where("phase", "=", phase)
      .where("status", "in", ["live", "closed"])
      .orderBy("created_at")
      .orderBy("question_key")
      .execute();
    return rows.map(to_question_row);
  }

  async find_question(question_id: string): Promise<QuestionRow | undefined> {
    const row = await this.db
      .selectFrom("questions")
      .select(QUESTION_COLUMNS)
      .where("id", "=", question_id)
      .where("status", "in", ["live", "closed"])
      .where("game_id", "is not", null)
      .executeTakeFirst();
    return row ? to_question_row(row) : undefined;
  }

  async list_answers(user_id: string, question_ids: readonly string[]): Promise<AnswerRow[]> {
    if (question_ids.length === 0) {
      return [];
    }
    return this.db
      .selectFrom("user_answers")
      .select(["question_id", "answer", "points_awarded"])
      .where("user_id", "=", user_id)
      .where("question_id", "in", question_ids)
      .execute();
  }

  async count_answers(question_ids: readonly string[]): Promise<AnswerCount[]> {
    if (question_ids.length === 0) {
      return [];
    }
    return this.db
      .selectFrom("user_answers")
      .innerJoin("users", "users.id", "user_answers.user_id")
      .select(["question_id", "answer", sql<number>`count(*)::int`.as("count")])
      .where("question_id", "in", question_ids)
      .where("users.deleted_at", "is", null)
      .groupBy(["question_id", "answer"])
      .execute();
  }

  async insert_answer(
    user_id: string,
    question_id: string,
    answer: string,
    points_awarded: number | null,
  ): Promise<boolean> {
    const row = await this.db
      .insertInto("user_answers")
      .values({ user_id, question_id, answer, points_awarded })
      .onConflict((conflict) => conflict.columns(["user_id", "question_id"]).doNothing())
      .returning("id")
      .executeTakeFirst();
    return row !== undefined;
  }

  async find_latest_facts(game_id: string): Promise<Fact[] | undefined> {
    const row = await this.db
      .selectFrom("fact_sheets")
      .select("facts")
      .where("game_id", "=", game_id)
      .orderBy("built_at", "desc")
      .limit(1)
      .executeTakeFirst();
    return row ? z.array(fact_schema).parse(row.facts) : undefined;
  }
}
