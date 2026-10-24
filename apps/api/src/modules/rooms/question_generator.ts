import type { RoomTopic } from "@voita_kone/shared_types";
import type { RoomQuestionDraft } from "./question_picker";

export interface QuestionRequest {
  topic: RoomTopic;
  /** Prompts already asked in this room (repeats only after the whole bank is used). */
  used_prompts: readonly string[];
  /** room id + slot: the same slot always gets the same question. */
  seed: string;
}

export interface GeneratedQuestion extends RoomQuestionDraft {
  source: "mock" | "llm";
}

/** Writes the next room question. Mock bank now; an LLM later (ROOM_QUESTIONS_SOURCE). */
export interface QuestionGenerator {
  generate(request: QuestionRequest): Promise<GeneratedQuestion>;
}
