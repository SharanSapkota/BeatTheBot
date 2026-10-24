import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { save_session_token } from "../../lib/session";
import { LAINE, build_game } from "../../test_helpers/game_fixture";
import { mock_api } from "../../test_helpers/mock_api";
import { make_question } from "../../test_helpers/questions";
import { render_at } from "../../test_helpers/render_app";
import { AfterGameScreen } from "./after_game_screen";

const GAME = build_game("final");
const STORY_PATH = `/games/${GAME.id}/stories?type=what_it_means`;

describe("AfterGameScreen: what it means", () => {
  it("shows the published story with its label", async () => {
    mock_api({
      [STORY_PATH]: {
        id: "33333333-3333-4333-8333-333333333333",
        headline: "Kärpät's relegation risk drops to 27%",
        body: "Kärpät beat Ilves 3–1 at home.",
        label_text: "AI-written from Liiga data. Checked by Kaleva sports desk, 21:47.",
      },
    });
    render_at(<AfterGameScreen game={GAME} />);

    expect(
      await screen.findByRole("heading", { name: "Kärpät's relegation risk drops to 27%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI-written from Liiga data. Checked by Kaleva sports desk, 21:47."),
    ).toBeInTheDocument();
  });

  it("says the story is being checked until an editor approves it", async () => {
    mock_api({ [STORY_PATH]: null });
    render_at(<AfterGameScreen game={GAME} />);

    expect(
      await screen.findByRole("heading", { name: "The story is being checked" }),
    ).toBeInTheDocument();
  });
});

describe("AfterGameScreen: result quiz and player vote", () => {
  const QUESTIONS_PATH = `/games/${GAME.id}/questions?phase=after`;
  const QUIZ_ID = "44444444-4444-4444-8444-444444444441";
  const VOTE_ID = "44444444-4444-4444-8444-444444444442";
  const QUESTIONS = [
    make_question({
      id: QUIZ_ID,
      game_id: GAME.id,
      prompt: "Who scored the first goal of the game?",
      options: [
        { id: "a", label: "Joonas Niemi" },
        { id: "b", label: "Eetu Laine" },
      ],
      correct_option: null,
      explanation: null,
    }),
    make_question({
      id: VOTE_ID,
      game_id: GAME.id,
      question_type: "player_vote",
      prompt: "Player of the game",
      options: [{ id: LAINE.id, label: "Eetu Laine" }],
      points: 1,
      correct_option: null,
      explanation: null,
    }),
  ];

  it("saves a quiz answer to the API for a signed-in user", async () => {
    save_session_token("token-1");
    const api = mock_api({
      [STORY_PATH]: null,
      [QUESTIONS_PATH]: QUESTIONS,
      [`POST /questions/${QUIZ_ID}/answers`]: {
        question_id: QUIZ_ID,
        answer: "b",
        correct: true,
        points_awarded: 2,
        correct_option: "b",
        explanation: "Correct!",
      },
    });
    render_at(<AfterGameScreen game={GAME} />);

    const quiz_group = await screen.findByRole("group", { name: "Answer options" });
    fireEvent.click(within(quiz_group).getByRole("button", { name: "Eetu Laine" }));

    await waitFor(() => {
      expect(api.requests.find((request) => request.method === "POST")).toMatchObject({
        path: `/questions/${QUIZ_ID}/answers`,
        body: { answer: "b" },
        authorization: "Bearer token-1",
      });
    });
  });

  it("asks for a name before the first vote", async () => {
    mock_api({ [STORY_PATH]: null, [QUESTIONS_PATH]: QUESTIONS });
    render_at(<AfterGameScreen game={GAME} />);

    const vote_group = await screen.findByRole("group", {
      name: "Vote for the player of the game",
    });
    fireEvent.click(within(vote_group).getByRole("button", { name: "Eetu Laine" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Save and answer" })).toBeInTheDocument();
  });
});
