import type { Question } from "@voita_kone/shared_types";
import { useState } from "react";
import { Card } from "../../components/card";
import { PointsBadge } from "../../components/points_badge";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { class_names } from "../../lib/class_names";
import type { GamePicks } from "../../lib/picks";
import { after_copy } from "./copy";
import styles from "./result_quiz.module.css";

interface ResultQuizProps {
  /** The result_quiz questions, in order. */
  questions: readonly Question[];
  picks: GamePicks;
  on_answer: (question: Question, option_id: string) => void;
}

/**
 * One question at a time; after answering, the right answer turns green and a wrong pick red
 * (real games: as soon as the API has saved the answer and sent the right one back).
 */
export function ResultQuiz({ questions, picks, on_answer }: ResultQuizProps) {
  const first_unanswered = questions.findIndex(
    (question) => picks.quiz_answers[question.id] === undefined,
  );
  const [index, set_index] = useState(first_unanswered === -1 ? 0 : first_unanswered);
  const question = questions[index];
  if (!question) {
    return null;
  }
  const answer = picks.quiz_answers[question.id];
  const has_answer = answer !== undefined;
  const right = question.correct_option;
  const is_checked = has_answer && right !== null;
  const is_last = index === questions.length - 1;
  const correct_count = questions.filter(
    (item) => item.correct_option !== null && picks.quiz_answers[item.id] === item.correct_option,
  ).length;

  const option_class = (option_id: string) => {
    if (is_checked && option_id === right) {
      return styles.right;
    }
    if (is_checked && option_id === answer) {
      return styles.wrong;
    }
    return undefined;
  };

  return (
    <Card accent="you">
      <KalevaSectionTitle
        mobile_variant="card"
        title={after_copy.quiz_title(index + 1, questions.length)}
        right={<PointsBadge text={after_copy.quiz_points(question.points)} />}
      />
      <p className={styles.prompt}>{question.prompt}</p>
      <div role="group" aria-label={after_copy.quiz_group} className={styles.options}>
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === answer}
            disabled={has_answer || question.is_locked}
            className={class_names(styles.option, option_class(option.id))}
            onClick={() => on_answer(question, option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {is_checked && question.explanation && (
        <p className={styles.feedback} role="status">
          {answer === right ? question.explanation.right : question.explanation.wrong}
        </p>
      )}
      {has_answer && !is_last && (
        <button type="button" className={styles.next} onClick={() => set_index(index + 1)}>
          {after_copy.quiz_next}
        </button>
      )}
      {has_answer && is_last && (
        <p className={styles.done}>{after_copy.quiz_done(correct_count, questions.length)}</p>
      )}
    </Card>
  );
}
