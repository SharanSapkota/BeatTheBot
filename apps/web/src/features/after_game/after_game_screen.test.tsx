import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { save_session_token } from "../../lib/session";
import { LAINE, build_game } from "../../test_helpers/game_fixture";
import { mock_api } from "../../test_helpers/mock_api";
import { make_question } from "../../test_helpers/questions";
import { render_at } from "../../test_helpers/render_app";
import { AfterGameScreen } from "./after_game_screen";

const GAME = build_game("final");
const STORY_PATH = `/games/${GAME.id}/stories?type=summary`;

describe("AfterGameScreen: AI summary", () => {
  it("shows the published summary with its label and report button", async () => {
    mock_api({
      [STORY_PATH]: {
        id: "33333333-3333-4333-8333-333333333333",
        story_type: "summary",
        headline: "Kärpät's relegation risk drops to 27%",
        body: "Kärpät beat Ilves 3–1 at home.",
        bullets: [],
        label_text: "Written with AI from Liiga data · checked by Kaleva",
        source: "llm",
        last_meetings: [],
        correction: { corrected_at: "2026-10-24T19:47:00.000Z", note: "The scorer was fixed" },
        published_at: "2026-10-24T19:30:00.000Z",
      },
    });
    render_at(<AfterGameScreen game={GAME} />);

    expect(
      await screen.findByRole("heading", { name: "Kärpät's relegation risk drops to 27%" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AI SUMMARY")).toBeInTheDocument();
    expect(
      screen.getByText("Written with AI from Liiga data · checked by Kaleva"),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Corrected \d\d:\d\d: The scorer was fixed$/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Report an error" }).length).toBeGreaterThan(0);
  });

  it("says the summary is coming soon until it is published (no sample text)", async () => {
    mock_api({ [STORY_PATH]: null });
    render_at(<AfterGameScreen game={GAME} />);

    expect(await screen.findByRole("heading", { name: "Summary coming soon" })).toBeInTheDocument();
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
