import type { ResultQuiz as ResultQuizData } from "@voita_kone/shared_types";
import { useState } from "react";
import { Card } from "../../components/card";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { class_names } from "../../lib/class_names";
import type { GamePicks } from "../../lib/picks";
import { after_copy } from "./copy";
import styles from "./result_quiz.module.css";

interface ResultQuizProps {
  quiz: ResultQuizData;
  picks: GamePicks;
  update: (change: (picks: GamePicks) => GamePicks) => void;
}

/** One question at a time; after answering, the right answer turns green and a wrong pick red. */
export function ResultQuiz({ quiz, picks, update }: ResultQuizProps) {
  const first_unanswered = quiz.questions.findIndex(
    (question) => picks.quiz_answers[question.id] === undefined,
  );
  const [index, set_index] = useState(first_unanswered === -1 ? 0 : first_unanswered);
  const question = quiz.questions[index];
  if (!question) {
    return null;
  }
  const answer = picks.quiz_answers[question.id];
  const has_answer = answer !== undefined;
  const is_last = index === quiz.questions.length - 1;
  const correct_count = quiz.questions.filter(
    (item) => picks.quiz_answers[item.id] === item.correct_option,
  ).length;

  const option_class = (option: string) => {
    if (has_answer && option === question.correct_option) {
      return styles.right;
    }
    if (has_answer && option === answer) {
      return styles.wrong;
    }
    return undefined;
  };

  return (
    <Card accent="you">
      <SectionTitle
        title={after_copy.quiz_title(index + 1, quiz.questions.length)}
        right={<PointsBadge text={after_copy.quiz_points(quiz.points_each)} />}
      />
      <p className={styles.prompt}>{question.prompt}</p>
      <div role="group" aria-label={after_copy.quiz_group} className={styles.options}>
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === answer}
            disabled={has_answer}
            className={class_names(styles.option, option_class(option))}
            onClick={() =>
              update((current) => ({
                ...current,
                quiz_answers: { ...current.quiz_answers, [question.id]: option },
              }))
            }
          >
            {option}
          </button>
        ))}
      </div>
      {has_answer && (
        <p className={styles.feedback} role="status">
          {answer === question.correct_option
            ? question.explanation_right
            : question.explanation_wrong}
        </p>
      )}
      {has_answer && !is_last && (
        <button type="button" className={styles.next} onClick={() => set_index(index + 1)}>
          {after_copy.quiz_next}
        </button>
      )}
      {has_answer && is_last && (
        <p className={styles.done}>{after_copy.quiz_done(correct_count, quiz.questions.length)}</p>
      )}
    </Card>
  );
}
