import type { RoomEmoji, RoomRevealedQuestion } from "@voita_kone/shared_types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { class_names } from "../../lib/class_names";
import { format_percent } from "../../lib/format";
import { toggle_reaction } from "./api";
import { rooms_copy } from "./copy";
import styles from "./revealed_question.module.css";

function result_line(question: RoomRevealedQuestion): {
  text: string;
  tone: "good" | "bad" | "plain";
} {
  if (question.my_answer === null) {
    return { text: rooms_copy.not_answered, tone: "plain" };
  }
  if (question.correct_option === null) {
    return { text: rooms_copy.opinion_points(question.my_points ?? 0), tone: "plain" };
  }
  return question.my_answer === question.correct_option
    ? { text: rooms_copy.right(question.my_points ?? 0), tone: "good" }
    : { text: rooms_copy.wrong, tone: "bad" };
}

/** A revealed question: the right answer, the room's split, right/wrong, points and reactions. */
export function RevealedQuestion({ question }: { question: RoomRevealedQuestion }) {
  const query_client = useQueryClient();
  const [busy, set_busy] = useState(false);
  const result = result_line(question);

  const react = async (emoji: RoomEmoji) => {
    set_busy(true);
    try {
      const { reactions } = await toggle_reaction(question.id, emoji);
      query_client.setQueryData<RoomRevealedQuestion[]>(["room_past", question.room_id], (old) =>
        old?.map((row) => (row.id === question.id ? { ...row, reactions } : row)),
      );
    } catch {
      // The next poll shows the saved state.
    }
    set_busy(false);
  };

  return (
    <article className={styles.question} aria-label={question.prompt}>
      <h3 className={styles.prompt}>{question.prompt}</h3>
      <ul className={styles.options}>
        {question.options.map((option) => {
          const split = question.split.find((row) => row.option_id === option.id);
          const share = split?.share ?? 0;
          const is_correct = option.id === question.correct_option;
          const is_mine = option.id === question.my_answer;
          return (
            <li
              key={option.id}
              className={class_names(
                styles.option,
                is_correct && styles.correct,
                is_mine && styles.mine,
              )}
            >
              <div className={styles.option_row}>
                <span className={styles.option_label}>
                  {option.label}
                  {is_correct && <span className={styles.tag}>{rooms_copy.correct_option}</span>}
                  {is_mine && <span className={styles.tag}>{rooms_copy.your_option}</span>}
                </span>
                <span className={styles.share}>{format_percent(share)}</span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ width: format_percent(share) }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className={class_names(styles.result, styles[result.tone])}>{result.text}</p>
      <p className={styles.meta}>
        {rooms_copy.answers_total(question.answer_count)}
        {question.correct_option !== null && <> · {rooms_copy.right_names(question.right_names)}</>}
      </p>
      <div role="group" aria-label={rooms_copy.reactions_label} className={styles.reactions}>
        {question.reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            type="button"
            aria-pressed={reaction.mine}
            aria-label={rooms_copy.react(reaction.emoji, reaction.count)}
            className={class_names(styles.reaction, reaction.mine && styles.reaction_mine)}
            disabled={busy}
            onClick={() => void react(reaction.emoji)}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            {reaction.count > 0 && <span className={styles.reaction_count}>{reaction.count}</span>}
          </button>
        ))}
      </div>
    </article>
  );
}
