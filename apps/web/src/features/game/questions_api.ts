import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  answer_result_response_schema,
  questions_response_schema,
  type GameDetail,
  type Question,
  type QuestionPhase,
} from "@voita_kone/shared_types";
import { useEffect, useState } from "react";
import { ApiError, api_get, api_request } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";
import { answer_of, useGamePicks, with_answer } from "../../lib/picks";
import { read_session_token, useSessionToken } from "../../lib/session";
import { sign_in_device } from "../account/api";
import { game_copy } from "./copy";

function goal_count(game: GameDetail): number {
  return game.events.filter((event) => event.event_type === "goal").length;
}

/**
 * Live picks (phase "live") or result quiz and vote (phase "after"). Real games: the user's
 * saved answers are copied into the picks on this device. Demo replays: the replay's questions,
 * answered on this device only.
 */
export function useQuestions(game: GameDetail, phase: QuestionPhase, enabled = true) {
  const { is_demo, moment } = useDemoMode();
  const token = useSessionToken();
  const [, update] = useGamePicks(game.id);
  const query = useQuery({
    queryKey: [
      "questions",
      game.id,
      phase,
      is_demo ? moment : "real",
      token,
      goal_count(game),
      game.period,
      game.state,
    ],
    enabled,
    queryFn: async (): Promise<Question[]> => {
      const path = is_demo
        ? `/demo/games/${game.id}/questions?phase=${phase}&moment=${moment}`
        : `/games/${game.id}/questions?phase=${phase}`;
      const response = await api_get(path, questions_response_schema);
      return response.data;
    },
  });

  const questions = query.data;
  useEffect(() => {
    const answered = (questions ?? []).filter((question) => question.my_answer !== null);
    if (answered.length === 0) {
      return;
    }
    update((current) =>
      answered.reduce((picks, question) => {
        const answer = question.my_answer?.answer ?? "";
        return answer_of(picks, question) === answer ? picks : with_answer(picks, question, answer);
      }, current),
    );
  }, [questions, update]);

  return query;
}

export function find_question(
  questions: readonly Question[] | undefined,
  question_type: Question["question_type"],
  target?: number,
): Question | undefined {
  return questions?.find(
    (question) =>
      question.question_type === question_type &&
      (target === undefined || question.target === target),
  );
}

export interface AnswerQuestion {
  answer: (question: Question, answer: string) => void;
  error_text: string | null;
  /** Show the name dialog (first answer on this device). */
  is_asking_name: boolean;
  submit_name: (display_name: string) => Promise<void>;
  cancel_name: () => void;
}

function error_text_of(error: unknown): string {
  if (error instanceof ApiError && error.code === "QUESTION_LOCKED") {
    return game_copy.answer_locked;
  }
  if (error instanceof ApiError && error.code === "ALREADY_ANSWERED") {
    return game_copy.answer_already;
  }
  return game_copy.answer_failed;
}

interface PendingAnswer {
  question: Question;
  answer: string;
}

/**
 * Answers a question. Real games: saved to the API once (signing in with a display name first if
 * needed), then the questions and the header points reload. Demo replays: on this device only.
 */
export function useAnswerQuestion(game: GameDetail): AnswerQuestion {
  const { is_demo } = useDemoMode();
  const [, update] = useGamePicks(game.id);
  const query_client = useQueryClient();
  const [pending, set_pending] = useState<PendingAnswer | null>(null);
  const [error_text, set_error_text] = useState<string | null>(null);

  const send = async ({ question, answer }: PendingAnswer) => {
    set_error_text(null);
    try {
      await api_request(
        "POST",
        `/questions/${question.id}/answers`,
        answer_result_response_schema,
        { answer },
      );
      update((current) => with_answer(current, question, answer));
    } catch (error) {
      set_error_text(error_text_of(error));
    }
    await query_client.invalidateQueries({ queryKey: ["questions", game.id] });
    await query_client.invalidateQueries({ queryKey: ["me"] });
  };

  return {
    answer: (question, answer) => {
      if (is_demo) {
        update((current) => with_answer(current, question, answer));
        return;
      }
      if (question.my_answer !== null || question.is_locked) {
        return;
      }
      if (read_session_token() === null) {
        set_pending({ question, answer });
        return;
      }
      void send({ question, answer });
    },
    error_text,
    is_asking_name: pending !== null,
    submit_name: async (display_name) => {
      await sign_in_device(display_name);
      const waiting = pending;
      set_pending(null);
      if (waiting) {
        await send(waiting);
      }
    },
    cancel_name: () => set_pending(null),
  };
}
