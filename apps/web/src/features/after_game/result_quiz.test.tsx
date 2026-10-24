import { fireEvent, render, screen } from "@testing-library/react";
import type { Question } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { useGamePicks, with_answer } from "../../lib/picks";
import { make_question } from "../../test_helpers/questions";
import { ResultQuiz } from "./result_quiz";

const QUESTIONS: Question[] = [
  make_question({
    id: "q1",
    prompt: "After this game, what is Kärpät's chance of relegation?",
    options: [
      { id: "a", label: "27%" },
      { id: "b", label: "34%" },
      { id: "c", label: "40%" },
    ],
    correct_option: "a",
    explanation: { right: "Correct! It is 27%.", wrong: "Not this time. It is 27%." },
  }),
  make_question({
    id: "q2",
    prompt: "Who scored first?",
    options: [
      { id: "a", label: "Eetu Laine" },
      { id: "b", label: "Joonas Niemi" },
    ],
    correct_option: "a",
    explanation: { right: "Correct! Laine.", wrong: "Not this time. Laine." },
  }),
];

function Quiz({ questions = QUESTIONS }: { questions?: Question[] }) {
  const [picks, update] = useGamePicks("quiz_game");
  return (
    <ResultQuiz
      questions={questions}
      picks={picks}
      on_answer={(question, option_id) =>
        update((current) => with_answer(current, question, option_id))
      }
    />
  );
}

describe("ResultQuiz", () => {
  it("shows wrong feedback, marks the right answer and moves to the next question", () => {
    render(<Quiz />);
    expect(screen.getByRole("heading", { name: "Result quiz · 1 of 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "40%" }));

    expect(screen.getByRole("status")).toHaveTextContent("Not this time. It is 27%.");
    expect(screen.getByRole("button", { name: "40%" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "27%" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.click(screen.getByRole("button", { name: "Eetu Laine" }));

    expect(screen.getByRole("status")).toHaveTextContent("Correct! Laine.");
    expect(screen.getByText("Quiz done · 1 of 2 right")).toBeInTheDocument();
  });

  it("waits for the right answer from the API before showing feedback", () => {
    render(
      <Quiz questions={QUESTIONS.map((question) => ({ ...question, correct_option: null }))} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "34%" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "34%" })).toHaveAttribute("aria-pressed", "true");
  });
});
