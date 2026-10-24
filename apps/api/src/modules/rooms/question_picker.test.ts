import { describe, expect, it } from "vitest";
import { pick_bank_question, to_question_draft, type BankQuestion } from "./question_picker";

const BANK: BankQuestion[] = Array.from({ length: 5 }, (_, index) => ({
  question_type: index % 2 === 0 ? "trivia" : "opinion",
  prompt: `Question ${String(index)}`,
  options: ["One", "Two", "Three"],
  correct_index: index % 2 === 0 ? 1 : null,
}));

describe("pick_bank_question", () => {
  it("never repeats a question until the bank is used up", () => {
    const used: string[] = [];
    for (let slot = 0; slot < BANK.length; slot += 1) {
      used.push(pick_bank_question(BANK, used, `room:${String(slot)}`).prompt);
    }
    expect(new Set(used).size).toBe(BANK.length);
  });

  it("then uses the least used questions again", () => {
    const used = BANK.map((question) => question.prompt);
    used.push("Question 0", "Question 1");
    const next = pick_bank_question(BANK, used, "room:7").prompt;
    expect(["Question 2", "Question 3", "Question 4"]).toContain(next);
  });

  it("gives the same question for the same seed", () => {
    expect(pick_bank_question(BANK, [], "room:1")).toBe(pick_bank_question(BANK, [], "room:1"));
  });
});

describe("to_question_draft", () => {
  it("keeps the right answer with its label and gives trivia 3 points", () => {
    const first = BANK[0] as BankQuestion;
    const draft = to_question_draft(first, "room:0");
    expect(draft.correct_option).toBe("b");
    expect(draft.options.find((option) => option.id === "b")?.label).toBe("Two");
    expect(draft.options.map((option) => option.id).sort()).toEqual(["a", "b", "c"]);
    expect(draft.points).toBe(3);
  });

  it("has no right answer for opinion questions and gives 1 point", () => {
    const draft = to_question_draft(BANK[1] as BankQuestion, "room:1");
    expect(draft.correct_option).toBeNull();
    expect(draft.points).toBe(1);
  });
});
