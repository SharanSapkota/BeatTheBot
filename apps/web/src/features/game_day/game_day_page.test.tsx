import { screen, waitFor, within } from "@testing-library/react";
import { game_summary_schema } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { save_session_token } from "../../lib/session";
import { build_game } from "../../test_helpers/game_fixture";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { GameDayPage } from "./game_day_page";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const SPORTS_DAY = {
  date: "2026-10-24",
  sports: [
    { sport: "hockey", game_count: 8, live_count: 0 },
    { sport: "football", game_count: 3, live_count: 0 },
    { sport: "basketball", game_count: 0, live_count: 0 },
  ],
};

describe("GameDayPage", () => {
  it('shows "No hockey games today" with a Show demo button', async () => {
    mock_api({
      "/game_days/today?sport=hockey": { date: "2026-10-24", games: [], demo_replay: false },
    });
    render_at(<GameDayPage sport="hockey" />);

    expect(
      await screen.findByRole("heading", { name: "No hockey games today" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show demo" })).toBeInTheDocument();
  });

  it("shows the featured game with the fans' split and the user's points", async () => {
    // A summary is the detail without events (zod drops the extra fields).
    const game = game_summary_schema.parse(build_game("upcoming"));
    save_session_token("test-token");
    mock_api({
      "/game_days/today?sport=hockey": { date: "2026-10-24", games: [game], demo_replay: false },
      "/me": { id: USER_ID, display_name: "Mika", role: "user", total_points: 1240 },
      [`/games/${game.id}/crowd`]: {
        total_picks: 50,
        home_picks: 31,
        away_picks: 19,
        draw_picks: 0,
        home_pick_share: 0.62,
      },
    });
    render_at(<GameDayPage sport="hockey" />);

    const card = (await screen.findByText("YOUR TEAM'S GAME")).closest("a");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("Make your picks")).toBeInTheDocument();
    expect(await within(card as HTMLElement).findByText("Fans: 62% Kärpät")).toBeInTheDocument();
    // The points use a no-break space ("1 240"); toHaveTextContent normalizes it.
    await waitFor(() => expect(screen.getByRole("banner")).toHaveTextContent("1 240 pts"));
    expect(screen.getByText("Sat 24 Oct · 1 game · Liiga")).toBeInTheDocument();
    expect(screen.queryByText("PROTOTYPE · JUMP IN TIME")).not.toBeInTheDocument();
  });

  it("hides the points pill while signed out (no /me request)", async () => {
    const api = mock_api({
      "/game_days/today?sport=hockey": { date: "2026-10-24", games: [], demo_replay: false },
    });
    render_at(<GameDayPage sport="hockey" />);

    await screen.findByRole("heading", { name: "No hockey games today" });
    expect(screen.getByRole("banner")).not.toHaveTextContent("pts");
    expect(api.requested_paths).not.toContain("/me");
  });

  it("shows the time-jump bar in demo mode", async () => {
    mock_api({
      "/demo/game_day?moment=live&sport=hockey": {
        date: "2026-10-24",
        games: [],
        demo_replay: true,
      },
    });
    render_at(<GameDayPage sport="hockey" />, { url: "/?demo=1&moment=live" });

    expect(screen.getByText("PROTOTYPE · JUMP IN TIME")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live · 19:42" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      await screen.findByRole("heading", { name: "No hockey games today" }),
    ).toBeInTheDocument();
  });

  it("has sport tabs with today's counts, the current one marked, demo mode kept", async () => {
    mock_api({
      "/demo/sports": SPORTS_DAY,
      "/demo/game_day?moment=final&sport=football": {
        date: "2026-10-24",
        games: [],
        demo_replay: true,
      },
    });
    render_at(<GameDayPage sport="football" />, { url: "/?demo=1&moment=final" });

    const tabs = screen.getByRole("navigation", { name: "Sports" });
    const football = await within(tabs).findByRole("link", { name: "Football, 3 games today" });
    expect(football).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "Hockey, 8 games today" })).toHaveAttribute(
      "href",
      "/games/hockey?demo=1&moment=final",
    );
    expect(
      await screen.findByRole("heading", { name: "No football games today" }),
    ).toBeInTheDocument();
  });

  it("shows a football game's league, the draw split and the Sample data badge", async () => {
    const game = game_summary_schema.parse(
      build_game("upcoming", {
        sport: "football",
        league: { id: "00000000-0000-4000-8000-000000000002", name: "Veikkausliiga" },
        featured: false,
        data_source: "demo",
      }),
    );
    mock_api({
      "/sports": SPORTS_DAY,
      "/game_days/today?sport=football": { date: "2026-10-24", games: [game], demo_replay: false },
      [`/games/${game.id}/crowd`]: {
        total_picks: 10,
        home_picks: 3,
        away_picks: 2,
        draw_picks: 5,
        home_pick_share: 0.3,
      },
    });
    render_at(<GameDayPage sport="football" />);

    const card = (await screen.findByText("TODAY'S TOP GAME")).closest("a");
    expect(within(card as HTMLElement).getByText("Sample data")).toBeInTheDocument();
    expect(await within(card as HTMLElement).findByText("Fans: 50% draw")).toBeInTheDocument();
    expect(screen.getByText("Sat 24 Oct · 1 game · Veikkausliiga")).toBeInTheDocument();
  });
});
