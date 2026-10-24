import type { RoomCurrentQuestion } from "@voita_kone/shared_types";
import { useEffect, useRef, useState } from "react";
import { Card } from "../../components/card";
import { ChoiceButtons } from "../../components/choice_buttons";
import { InlineError } from "../../components/inline_error";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { ApiError } from "../../lib/api_client";
import { format_short_countdown } from "../../lib/format";
import { useNow } from "../../lib/use_now";
import { answer_question } from "./api";
import { rooms_copy } from "./copy";
import styles from "./question_card.module.css";

interface QuestionCardProps {
  question: RoomCurrentQuestion;
  /** When the question was fetched (the countdown runs from the server's seconds_left). */
  fetched_at: number;
  /** Refetches the room after an answer and when the countdown ends (the reveal). */
  on_refresh: () => Promise<void>;
}

/** The open question: countdown, answer buttons, then "Waiting for the reveal". */
export function QuestionCard({ question, fetched_at, on_refresh }: QuestionCardProps) {
  const now = useNow(1000);
  const [saving, set_saving] = useState<string | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const refreshed_for = useRef<string | null>(null);
  const left_ms = question.seconds_left * 1000 - (now.getTime() - fetched_at);
  const is_locked = left_ms <= 0;
  const my_answer = saving ?? question.my_answer;

  useEffect(() => {
    // Time is up: fetch the reveal and the next question once.
    if (is_locked && refreshed_for.current !== question.id) {
      refreshed_for.current = question.id;
      void on_refresh();
    }
  }, [is_locked, question.id, on_refresh]);

  const answer = async (option: string) => {
    if (my_answer !== null || is_locked) {
      return;
    }
    set_saving(option);
    set_error(null);
    try {
      await answer_question(question.id, option);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "";
      set_error(code === "QUESTION_LOCKED" ? rooms_copy.locked : rooms_copy.answer_failed);
      if (code !== "ALREADY_ANSWERED") {
        set_saving(null);
      }
    }
    await on_refresh();
    set_saving(null);
  };

  const is_trivia = question.question_type === "trivia";
  return (
    <Card accent="you" labelled_by="room_question_title">
      <KalevaSectionTitle
        id="room_question_title"
        title={rooms_copy.question_title}
        mobile_variant="card"
        right={
          <span role="timer" className={styles.timer} aria-live="off">
            {rooms_copy.seconds_left(format_short_countdown(Math.max(0, left_ms)))}
          </span>
        }
      />
      <p className={styles.meta}>
        <span className={styles.type}>{is_trivia ? rooms_copy.trivia : rooms_copy.opinion}</span>
        {rooms_copy.points_hint(question.points, is_trivia)}
      </p>
      <h2 className={styles.prompt} data-testid="room_prompt">
        {question.prompt}
      </h2>
      <ChoiceButtons
        label={rooms_copy.answer_group}
        choices={question.options}
        selected_id={my_answer}
        on_select={(option) => void answer(option)}
        size="medium"
        columns={question.options.length > 2 ? 2 : question.options.length}
        disabled={my_answer !== null || is_locked}
      />
      {error && <InlineError text={error} />}
      {my_answer !== null && (
        <p className={styles.waiting} role="status">
          <strong>{rooms_copy.waiting}</strong> ·{" "}
          {rooms_copy.answered_count(question.answer_count, question.member_count)}
        </p>
      )}
      {my_answer === null && (
        <p className={styles.count}>
          {rooms_copy.answered_count(question.answer_count, question.member_count)}
        </p>
      )}
    </Card>
  );
}
