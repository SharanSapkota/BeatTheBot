import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { clear_picks_cache } from "../../lib/picks";
import {
  ILVES,
  KARPAT,
  LAINE,
  MAKELA,
  NIEMI,
  build_game,
  build_player,
} from "../../test_helpers/game_fixture";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { BeforeGameScreen } from "./before_game_screen";

const GAME = build_game("upcoming");

function mock_rosters() {
  return mock_api({
    [`/teams/${KARPAT.id}/players`]: [build_player(LAINE, 5, 9), build_player(NIEMI, 2, 9)],
    [`/teams/${ILVES.id}/players`]: [build_player(MAKELA, 1, 12)],
  });
}

function render_screen() {
  return render_at(<BeforeGameScreen game={GAME} />);
}

describe("BeforeGameScreen", () => {
  it("shows the AI's pick from sample data while the endpoint is missing", async () => {
    mock_rosters();
    render_screen();

    expect(await screen.findByRole("heading", { name: "Kärpät win · 62%" })).toBeInTheDocument();
    expect(screen.getByText("Kärpät won 4 of their last 5 home games.")).toBeInTheDocument();
  });

  it("toggles the winner pick", () => {
    mock_rosters();
    render_screen();
    const group = screen.getByRole("group", { name: "Pick the winner" });
    const karpat = within(group).getByRole("button", { name: "Kärpät" });
    const ilves = within(group).getByRole("button", { name: "Ilves" });

    fireEvent.click(karpat);
    expect(karpat).toHaveAttribute("aria-pressed", "true");
    expect(ilves).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(ilves);
    expect(karpat).toHaveAttribute("aria-pressed", "false");
    expect(ilves).toHaveAttribute("aria-pressed", "true");
  });

  it("picks one scorer from both rosters and marks the AI's pick", async () => {
    mock_rosters();
    render_screen();
    const group = screen.getByRole("group", { name: "Pick a goal scorer" });
    const laine = await within(group).findByRole("button", { name: /Eetu Laine #19/ });
    const makela = within(group).getByRole("button", { name: /Aleksi Mäkelä #11/ });

    expect(await within(laine).findByText("AI pick")).toBeInTheDocument();
    expect(within(laine).getByText("Kärpät · 5 goals in last 5 games")).toBeInTheDocument();
    fireEvent.click(makela);
    expect(makela).toHaveAttribute("aria-pressed", "true");
    expect(laine).toHaveAttribute("aria-pressed", "false");
  });

  it("locks in, shows the saved state and keeps it after a reload", async () => {
    mock_rosters();
    const first_visit = render_screen();
    const lock_button = screen.getByRole("button", { name: "Pick a winner to lock in" });
    expect(lock_button).toBeDisabled();

    fireEvent.click(
      within(screen.getByRole("group", { name: "Pick the winner" })).getByRole("button", {
        name: "Kärpät",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Picks saved · edit until \d\d:\d\d/);

    // A reload forgets everything in memory; the picks come back from localStorage.
    first_visit.unmount();
    clear_picks_cache();
    render_screen();
    expect(await screen.findByText(/Picks saved · edit until/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Pick the winner" })).getByRole("button", {
        name: "Kärpät",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("unlocks again when a pick changes", () => {
    mock_rosters();
    render_screen();
    fireEvent.click(
      within(screen.getByRole("group", { name: "Pick the winner" })).getByRole("button", {
        name: "Kärpät",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));

    fireEvent.click(screen.getByRole("button", { name: "Kärpät one goal more" }));

    expect(screen.getByRole("button", { name: "Lock in my picks" })).toBeEnabled();
  });
});
