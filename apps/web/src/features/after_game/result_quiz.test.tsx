import { fireEvent, render, screen } from "@testing-library/react";
import type { ResultQuiz as ResultQuizData } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { useGamePicks } from "../../lib/picks";
import { ResultQuiz } from "./result_quiz";

const QUIZ: ResultQuizData = {
  points_each: 2,
  questions: [
    {
      id: "q1",
      prompt: "After tonight's win, what is Kärpät's chance of relegation?",
      options: ["27%", "34%", "40%"],
      correct_option: "27%",
      explanation_right: "Correct, +2.",
      explanation_wrong: "Not this time. The answer is 27%.",
    },
    {
      id: "q2",
      prompt: "Who scored first?",
      options: ["Eetu Laine", "Joonas Niemi"],
      correct_option: "Eetu Laine",
      explanation_right: "Correct, +2. Laine.",
      explanation_wrong: "Not this time. Laine.",
    },
  ],
};

function Quiz() {
  const [picks, update] = useGamePicks("quiz_game");
  return <ResultQuiz quiz={QUIZ} picks={picks} update={update} />;
}

describe("ResultQuiz", () => {
  it("shows wrong feedback, marks the right answer and moves to the next question", () => {
    render(<Quiz />);
    expect(screen.getByRole("heading", { name: "Result quiz · 1 of 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "40%" }));

    expect(screen.getByRole("status")).toHaveTextContent("Not this time. The answer is 27%.");
    expect(screen.getByRole("button", { name: "40%" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "27%" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.click(screen.getByRole("button", { name: "Eetu Laine" }));

    expect(screen.getByRole("status")).toHaveTextContent("Correct, +2. Laine.");
    expect(screen.getByText("Quiz done · 1 of 2 right")).toBeInTheDocument();
  });
});
