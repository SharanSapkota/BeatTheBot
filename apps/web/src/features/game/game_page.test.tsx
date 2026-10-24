import { screen } from "@testing-library/react";
import type { GameState } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { build_game } from "../../test_helpers/game_fixture";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { GamePage } from "./game_page";

function render_game(state: GameState) {
  const game = build_game(state);
  mock_api({ [`/games/${game.id}`]: game });
  render_at(<GamePage />, { url: `/games/${game.id}`, path: "/games/:game_id" });
}

describe("GamePage", () => {
  it.each<[GameState, string]>([
    ["upcoming", "1 · Who wins?"],
    ["live", "Who scores the next goal?"],
    ["final", "Your points"],
  ])("shows the right screen for a %s game", async (state, heading) => {
    render_game(state);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("uses the demo replay endpoint in demo mode", async () => {
    const game = build_game("live", { demo_replay: true });
    const api = mock_api({ [`/demo/games/${game.id}?moment=live`]: game });
    render_at(<GamePage />, {
      url: `/games/${game.id}?demo=1&moment=live`,
      path: "/games/:game_id",
    });

    expect(
      await screen.findByRole("heading", { name: "Who scores the next goal?" }),
    ).toBeInTheDocument();
    expect(api.requested_paths).toContain(`/demo/games/${game.id}?moment=live`);
    expect(screen.getAllByText("Demo replay").length).toBeGreaterThan(0);
  });

  it("shows a friendly error with Try again for an unknown game", async () => {
    mock_api({});
    render_at(<GamePage />, { url: "/games/unknown", path: "/games/:game_id" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
