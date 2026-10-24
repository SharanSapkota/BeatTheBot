import { screen, waitFor, within } from "@testing-library/react";
import { game_summary_schema } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { build_game } from "../../test_helpers/game_fixture";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { GameDayPage } from "./game_day_page";

describe("GameDayPage", () => {
  it('shows "No Liiga games today" with a Show demo button', async () => {
    mock_api({ "/game_days/today": { date: "2026-10-24", games: [], demo_replay: false } });
    render_at(<GameDayPage />);

    expect(
      await screen.findByRole("heading", { name: "No Liiga games today" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show demo" })).toBeInTheDocument();
  });

  it("shows the featured game with the AI pick and the user's points", async () => {
    // A summary is the detail without events (zod drops the extra fields).
    const game = game_summary_schema.parse(build_game("upcoming"));
    mock_api({ "/game_days/today": { date: "2026-10-24", games: [game], demo_replay: false } });
    render_at(<GameDayPage />);

    const card = (await screen.findByText("YOUR TEAM'S GAME")).closest("a");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("Make your picks")).toBeInTheDocument();
    expect(
      await within(card as HTMLElement).findByText("AI's pick: Kärpät win · 62%"),
    ).toBeInTheDocument();
    // The points use a no-break space ("1 240"); toHaveTextContent normalizes it.
    await waitFor(() => expect(screen.getByRole("banner")).toHaveTextContent("1 240 pts"));
    expect(screen.getByText("Sat 24 Oct · 1 game")).toBeInTheDocument();
    expect(screen.queryByText("PROTOTYPE · JUMP IN TIME")).not.toBeInTheDocument();
  });

  it("shows the time-jump bar in demo mode", async () => {
    mock_api({
      "/demo/game_day?moment=live": { date: "2026-10-24", games: [], demo_replay: true },
    });
    render_at(<GameDayPage />, { url: "/?demo=1&moment=live" });

    expect(screen.getByText("PROTOTYPE · JUMP IN TIME")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live · 19:42" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      await screen.findByRole("heading", { name: "No Liiga games today" }),
    ).toBeInTheDocument();
  });
});
