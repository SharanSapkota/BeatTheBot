import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { save_session_token } from "../../lib/session";
import {
  ILVES,
  KARPAT,
  LAINE,
  MAKELA,
  NIEMI,
  build_game,
  build_player,
} from "../../test_helpers/game_fixture";
import type { DataSays, Story, UserPrediction } from "@voita_kone/shared_types";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { BeforeGameScreen } from "./before_game_screen";

const GAME = build_game("upcoming");

const ROSTERS = {
  [`/teams/${KARPAT.id}/players`]: [build_player(LAINE, 5, 9), build_player(NIEMI, 2, 9)],
  [`/teams/${ILVES.id}/players`]: [build_player(MAKELA, 1, 12)],
};

function mock_rosters() {
  return mock_api(ROSTERS);
}

function mock_rosters_and(routes: Record<string, unknown>) {
  return mock_api({ ...ROSTERS, ...routes });
}

const USER = { id: "11111111-1111-4111-8111-111111111111", display_name: "Mika", role: "user" };

function saved_prediction(winner_team_id: string): UserPrediction {
  return {
    game_id: GAME.id,
    predicted_winner_team_id: winner_team_id,
    predicted_home_goals: 3,
    predicted_away_goals: 2,
    predicted_scorer_id: null,
    predicted_margin_band: null,
    points_awarded: null,
    created_at: "2026-10-24T10:00:00.000Z",
    updated_at: "2026-10-24T10:00:00.000Z",
  };
}

function pick_karpat() {
  fireEvent.click(
    within(screen.getByRole("group", { name: "Pick the winner" })).getByRole("button", {
      name: "Kärpät",
    }),
  );
}

const OTHER_SCORER = {
  id: "aaaaaaaa-0000-4000-8000-000000000044",
  first_name: "Ville",
  last_name: "Koskinen",
  jersey_number: 8,
};

/** What GET /games/:id/data_says returns once the model has run: numbers, never a pick. */
const DATA_SAYS: DataSays = {
  game_id: GAME.id,
  home_win_probability: 0.67,
  away_win_probability: 0.33,
  overtime_probability: 0.2,
  stakes: [{ team_id: ILVES.id, kind: "playoffs", if_win: 0.55, if_loss: 0.41 }],
  crowd: null,
  label_text: "Data says · calculated from Liiga data",
  model_version: "poisson_mc_v1",
  calculated_at: "2026-10-24T12:49:49.007Z",
};

const PREVIEW: Story = {
  id: "33333333-3333-4333-8333-333333333333",
  story_type: "preview",
  headline: "Kärpät vs Ilves",
  body: "- Kärpät won 4 of their last 5 games.\n- They last met on 1 Feb.\n- Data says Kärpät 67%.",
  bullets: [
    "Kärpät won 4 of their last 5 games.",
    "They last met on 1 Feb.",
    "Data says Kärpät 67%.",
  ],
  label_text: "Written with AI from Liiga data · checked by Kaleva",
  source: "llm",
  last_meetings: [
    { date: "2026-02-01", home_team: "Ilves", away_team: "Kärpät", home_goals: 2, away_goals: 4 },
  ],
  correction: null,
  published_at: "2026-10-24T10:00:00.000Z",
};

function mock_real_prediction() {
  return mock_api({
    [`/games/${GAME.id}/data_says`]: DATA_SAYS,
    [`/games/${GAME.id}/stories?type=preview`]: PREVIEW,
    [`POST /stories/${PREVIEW.id}/reports`]: { received: true },
    [`/teams/${KARPAT.id}/players`]: [
      build_player(LAINE, 5, 9),
      build_player(NIEMI, 2, 9),
      build_player(OTHER_SCORER, 1, 1),
    ],
    [`/teams/${ILVES.id}/players`]: [build_player(MAKELA, 1, 12)],
  });
}

function render_screen() {
  return render_at(<BeforeGameScreen game={GAME} />);
}

describe("BeforeGameScreen", () => {
  it("says the preview is coming soon when none is published (no sample text)", async () => {
    mock_rosters_and({ [`/games/${GAME.id}/stories?type=preview`]: null });
    render_screen();

    expect(await screen.findByRole("heading", { name: "Preview coming soon" })).toBeInTheDocument();
    expect(screen.queryByText(/AI pick/)).not.toBeInTheDocument();
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

  it("picks one scorer from both rosters and tags the player in form", async () => {
    mock_rosters();
    render_screen();
    const group = screen.getByRole("group", { name: "Pick a goal scorer" });
    const laine = await within(group).findByRole("button", { name: /Eetu Laine #19/ });
    const makela = within(group).getByRole("button", { name: /Aleksi Mäkelä #11/ });

    expect(await within(laine).findByText("In form")).toBeInTheDocument();
    expect(within(laine).getByText("Kärpät · 5 goals in last 5 games")).toBeInTheDocument();
    fireEvent.click(makela);
    expect(makela).toHaveAttribute("aria-pressed", "true");
    expect(laine).toHaveAttribute("aria-pressed", "false");
  });

  it("asks for a name on the first lock-in, signs in and saves the pick", async () => {
    const api = mock_rosters_and({
      "POST /auth/device": { token: "new-token", user: USER },
      [`POST /games/${GAME.id}/predictions`]: saved_prediction(KARPAT.id),
    });
    render_screen();
    const lock_button = screen.getByRole("button", { name: "Pick a winner to lock in" });
    expect(lock_button).toBeDisabled();

    pick_karpat();
    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));
    const dialog = screen.getByRole("dialog", { name: "What should we call you?" });
    fireEvent.change(within(dialog).getByLabelText("Display name"), {
      target: { value: "  Mika  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and lock in" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /Picks saved · edit until \d\d:\d\d/,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const sign_in = api.requests.find((request) => request.path === "/auth/device");
    expect(sign_in?.body).toEqual({ display_name: "Mika" });
    const save = api.requests.find(
      (request) => request.method === "POST" && request.path.endsWith("/predictions"),
    );
    expect(save?.authorization).toBe("Bearer new-token");
    expect(save?.body).toMatchObject({ predicted_winner_team_id: KARPAT.id });
  });

  it("asks again for a name that is empty", () => {
    mock_rosters();
    render_screen();
    pick_karpat();
    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and lock in" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Write a name of 1–30 characters.");
  });

  it("loads a pick saved earlier back as locked in", async () => {
    save_session_token("test-token");
    mock_rosters_and({
      [`/me/predictions?game_id=${GAME.id}`]: [saved_prediction(ILVES.id)],
    });
    render_screen();

    expect(await screen.findByText(/Picks saved · edit until/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Pick the winner" })).getByRole("button", {
        name: "Ilves",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("unlocks when a pick changes and saves the change with PUT", async () => {
    save_session_token("test-token");
    const api = mock_rosters_and({
      [`/me/predictions?game_id=${GAME.id}`]: [saved_prediction(KARPAT.id)],
      [`PUT /games/${GAME.id}/predictions`]: saved_prediction(KARPAT.id),
    });
    render_screen();
    await screen.findByText(/Picks saved · edit until/);

    fireEvent.click(screen.getByRole("button", { name: "Kärpät one goal more" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));

    expect(await screen.findByText(/Picks saved · edit until/)).toBeInTheDocument();
    expect(api.requests.some((request) => request.method === "PUT")).toBe(true);
  });

  it("says why the pick was not saved", async () => {
    save_session_token("test-token");
    mock_api(
      {},
      { [`POST /games/${GAME.id}/predictions`]: { status: 409, code: "PREDICTION_LOCKED" } },
    );
    render_screen();
    pick_karpat();

    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Picks are locked: the game has started",
    );
  });

  it("keeps demo replay picks on this device (no sign-in)", () => {
    const api = mock_rosters();
    render_at(<BeforeGameScreen game={GAME} />, { url: "/?demo=1&moment=before" });
    pick_karpat();

    fireEvent.click(screen.getByRole("button", { name: "Lock in my picks" }));

    expect(screen.getByRole("status")).toHaveTextContent(/Picks saved · edit until/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("shows the AI preview with its label, last meetings and a report button", async () => {
    mock_real_prediction();
    render_screen();

    expect(await screen.findByRole("heading", { name: "Kärpät vs Ilves" })).toBeInTheDocument();
    expect(screen.getByText("AI PREVIEW")).toBeInTheDocument();
    expect(screen.getByText("Kärpät won 4 of their last 5 games.")).toBeInTheDocument();
    expect(screen.getByText("Last meetings")).toBeInTheDocument();
    expect(
      screen.getByText("Written with AI from Liiga data · checked by Kaleva"),
    ).toBeInTheDocument();
  });

  it("sends an error report with the reader's reason", async () => {
    const api = mock_real_prediction();
    render_screen();
    await screen.findByRole("heading", { name: "Kärpät vs Ilves" });

    fireEvent.click(screen.getAllByRole("button", { name: "Report an error" })[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText("What is wrong?"), { target: { value: "Wrong date" } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByText("Thanks. The sports desk will check it.")).toBeInTheDocument();
    expect(api.requests.find((request) => request.method === "POST")).toMatchObject({
      path: `/stories/${PREVIEW.id}/reports`,
      body: { reason: "Wrong date" },
    });
  });

  it("shows what the data says: win chance and stakes, never a pick", async () => {
    mock_real_prediction();
    render_screen();

    expect(await screen.findByText("Ilves playoff chance")).toBeInTheDocument();
    expect(screen.getByText("Kärpät 67%")).toBeInTheDocument();
    expect(
      screen.getByText(/Data says · calculated from Liiga data · \d\d:\d\d/),
    ).toBeInTheDocument();
    expect(screen.getByText("No fan picks yet. Be the first to pick!")).toBeInTheDocument();
    expect(screen.queryByText(/AI pick|AI's pick/)).not.toBeInTheDocument();
  });

  it("says the data is not ready instead of showing numbers", async () => {
    mock_api(
      {},
      { [`/games/${GAME.id}/data_says`]: { status: 404, code: "PREDICTION_NOT_READY" } },
    );
    render_screen();

    expect(
      await screen.findByText(/calculated from Liiga statistics during the week before puck drop/),
    ).toBeInTheDocument();
    expect(screen.queryByText("What's at stake")).not.toBeInTheDocument();
  });
});
