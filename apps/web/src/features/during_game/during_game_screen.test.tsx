import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { read_picks } from "../../lib/picks";
import { save_session_token } from "../../lib/session";
import { build_game } from "../../test_helpers/game_fixture";
import { mock_api } from "../../test_helpers/mock_api";
import { make_question } from "../../test_helpers/questions";
import { render_at } from "../../test_helpers/render_app";
import { DuringGameScreen } from "./during_game_screen";

const GAME = build_game("live");
const GOAL_COUNT = GAME.events.filter((event) => event.event_type === "goal").length;
const NEXT_GOAL_ID = "55555555-5555-4555-8555-555555555551";

function live_questions() {
  return [
    make_question({
      id: NEXT_GOAL_ID,
      game_id: GAME.id,
      phase: "live",
      question_type: "next_goal",
      prompt: "Who scores the next goal?",
      options: [
        { id: "home", label: GAME.home_team.name },
        { id: "away", label: GAME.away_team.name },
        { id: "none", label: "No more goals" },
      ],
      points: 5,
      target: GOAL_COUNT,
      locks_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      correct_option: null,
      explanation: null,
    }),
  ];
}

describe("DuringGameScreen: live picks", () => {
  it("saves the next-goal pick to the API once", async () => {
    save_session_token("token-1");
    const api = mock_api({
      [`/games/${GAME.id}/questions?phase=live`]: live_questions(),
      [`POST /questions/${NEXT_GOAL_ID}/answers`]: {
        question_id: NEXT_GOAL_ID,
        answer: "away",
        correct: null,
        points_awarded: null,
        correct_option: null,
        explanation: null,
      },
    });
    render_at(<DuringGameScreen game={GAME} />);

    const group = await screen.findByRole("group", { name: "Pick who scores the next goal" });
    await waitFor(() => {
      expect(within(group).getByRole("button", { name: GAME.away_team.name })).toBeEnabled();
    });
    fireEvent.click(within(group).getByRole("button", { name: GAME.away_team.name }));

    await waitFor(() => {
      expect(read_picks(GAME.id).next_goal_picks).toEqual([
        { goal_index: GOAL_COUNT, choice: "away" },
      ]);
    });
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });

  it("keeps demo replay picks on the device (nothing is sent)", async () => {
    const api = mock_api({
      [`/demo/games/${GAME.id}/questions?phase=live&moment=live`]: live_questions(),
    });
    render_at(<DuringGameScreen game={GAME} />, { url: "/?demo=1&moment=live" });

    const group = await screen.findByRole("group", { name: "Pick who scores the next goal" });
    await waitFor(() => {
      expect(within(group).getByRole("button", { name: GAME.home_team.name })).toBeEnabled();
    });
    fireEvent.click(within(group).getByRole("button", { name: GAME.home_team.name }));

    expect(read_picks(GAME.id).next_goal_picks).toEqual([
      { goal_index: GOAL_COUNT, choice: "home" },
    ]);
    expect(api.requests.filter((request) => request.method === "POST")).toEqual([]);
  });
});
