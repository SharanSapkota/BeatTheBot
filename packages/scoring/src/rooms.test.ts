import { describe, expect, it } from "vitest";
import { ROOM_POINTS, score_room_answer } from "./rooms";

const TRIVIA = { question_type: "trivia", correct_option: "b" } as const;
const OPINION = { question_type: "opinion", correct_option: null } as const;

describe("score_room_answer", () => {
  it("gives 3 points for a right trivia answer", () => {
    expect(ROOM_POINTS.trivia_correct).toBe(3);
    expect(score_room_answer(TRIVIA, "b")).toBe(3);
  });

  it("gives 0 points for a wrong trivia answer", () => {
    expect(score_room_answer(TRIVIA, "a")).toBe(0);
  });

  it("gives 1 point for any opinion answer", () => {
    expect(score_room_answer(OPINION, "a")).toBe(1);
    expect(score_room_answer(OPINION, "d")).toBe(1);
  });

  it("gives the same points when scored again", () => {
    expect(score_room_answer(TRIVIA, "b")).toBe(score_room_answer(TRIVIA, "b"));
  });
});
