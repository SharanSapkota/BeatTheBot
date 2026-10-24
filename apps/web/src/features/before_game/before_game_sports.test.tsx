import { fireEvent, screen, within } from "@testing-library/react";
import type { UserPrediction } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { save_session_token } from "../../lib/session";
import {
  ILVES,
  KARPAT,
  LAINE,
  MAKELA,
  build_game,
  build_player,
} from "../../test_helpers/game_fixture";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { BeforeGameScreen } from "./before_game_screen";

// The Before screen follows the sport's picks (packages/scoring SPORTS).
const FOOTBALL = build_game("upcoming", {
  id: "99999999-9999-4999-8999-0000000000f1",
  sport: "football",
  league: { id: "00000000-0000-4000-8000-000000000002", name: "Veikkausliiga" },
  data_source: "demo",
});
const BASKETBALL = build_game("upcoming", {
  id: "99999999-9999-4999-8999-0000000000b1",
  sport: "basketball",
  league: { id: "00000000-0000-4000-8000-000000000003", name: "Korisliiga" },
});
const ROSTERS = {
  [`/teams/${KARPAT.id}/players`]: [build_player(LAINE, 2, 6)],
  [`/teams/${ILVES.id}/players`]: [build_player(MAKELA, 1, 4)],
};

function saved(game_id: string): UserPrediction {
  return {
    game_id,
    predicted_winner_team_id: null,
    predicted_home_goals: 1,
    predicted_away_goals: 1,
    predicted_scorer_id: null,
    predicted_margin_band: null,
    points_awarded: null,
    created_at: "2026-10-24T10:00:00.000Z",
    updated_at: "2026-10-24T10:00:00.000Z",
  };
}

describe("BeforeGameScreen: football", () => {
  it("offers 1 X 2, the exact score after 90 minutes and a scorer; no Data says", () => {
    mock_api(ROSTERS);
    render_at(<BeforeGameScreen game={FOOTBALL} />);

    const outcome = screen.getByRole("group", { name: "Pick home win, draw or away win" });
    expect(
      within(outcome)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Kärpät", "Draw", "Ilves"]);
    expect(screen.getByText("1 · Result: 1 X 2")).toBeInTheDocument();
    expect(screen.getByText("Score after 90 minutes, stoppage time included.")).toBeInTheDocument();
    expect(screen.getByText("3 · Who scores?")).toBeInTheDocument();
    expect(screen.queryByText("Data says")).not.toBeInTheDocument();
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    expect(screen.queryByText(/AI pick|vs AI/)).not.toBeInTheDocument();
  });

  it("saves a draw pick as no winner, starting from 1–1", async () => {
    save_session_token("test-token");
    const api = mock_api({
      ...ROSTERS,
      [`/me/predictions?game_id=${FOOTBALL.id}`]: [],
      [`POST /games/${FOOTBALL.id}/predictions`]: saved(FOOTBALL.id),
    });
    render_at(<BeforeGameScreen game={FOOTBALL} />);

    fireEvent.click(screen.getByRole("button", { name: "Draw" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Picks saved/);
    const save = api.requests.find((request) => request.method === "POST");
    expect(save?.body).toEqual({
      predicted_winner_team_id: null,
      predicted_home_goals: 1,
      predicted_away_goals: 1,
      predicted_scorer_id: null,
      predicted_margin_band: null,
    });
  });
});

describe("BeforeGameScreen: basketball", () => {
  it("offers the winner, the margin band and the top scorer; no exact score", async () => {
    save_session_token("test-token");
    const api = mock_api({
      ...ROSTERS,
      [`/me/predictions?game_id=${BASKETBALL.id}`]: [],
      [`POST /games/${BASKETBALL.id}/predictions`]: saved(BASKETBALL.id),
    });
    render_at(<BeforeGameScreen game={BASKETBALL} />);

    expect(screen.getByText("2 · Winning margin")).toBeInTheDocument();
    expect(screen.queryByText(/Exact score/)).not.toBeInTheDocument();
    expect(await screen.findByText("3 · Top scorer")).toBeInTheDocument();
    expect(screen.getByText("Your possible points").nextSibling).toHaveTextContent("40 pts");

    fireEvent.click(screen.getByRole("button", { name: "Ilves" }));
    fireEvent.click(screen.getByRole("button", { name: "6–10" }));
    fireEvent.click(await screen.findByRole("button", { name: /Aleksi Mäkelä/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));

    await screen.findByRole("status");
    const save = api.requests.find((request) => request.method === "POST");
    expect(save?.body).toEqual({
      predicted_winner_team_id: ILVES.id,
      predicted_home_goals: null,
      predicted_away_goals: null,
      predicted_scorer_id: MAKELA.id,
      predicted_margin_band: "6_10",
    });
  });
});
