import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { AdminLeague, AdminMatch, PlayerSummary } from "@voita_kone/shared_types";
import { beforeEach, describe, expect, it } from "vitest";
import { save_session_token } from "../../lib/session";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { AdminMatchesTab } from "./admin_matches_tab";

const FOOTBALL_ID = "00000000-0000-4000-8000-000000000002";
const BASKETBALL_ID = "00000000-0000-4000-8000-000000000003";
const OULU = "f0000000-0000-4000-8000-000000000001";
const HJK = "f0000000-0000-4000-8000-000000000002";
const KARHU = "b0000000-0000-4000-8000-000000000001";
const MATCH_ID = "a0000000-0000-4000-8000-000000000001";
const SCORER = "c0000000-0000-4000-8000-000000000001";

const LEAGUES: AdminLeague[] = [
  {
    id: FOOTBALL_ID,
    name: "Veikkausliiga",
    sport: "football",
    country: "FI",
    teams: [
      { id: OULU, name: "AC Oulu", short_name: "ACO" },
      { id: HJK, name: "HJK", short_name: "HJK" },
    ],
  },
  {
    id: BASKETBALL_ID,
    name: "Korisliiga",
    sport: "basketball",
    country: "FI",
    teams: [{ id: KARHU, name: "Karhu Basket", short_name: "KAR" }],
  },
];

function team(id: string, name: string) {
  return {
    id,
    external_id: name,
    name,
    short_name: name.slice(0, 3),
    city: null,
    logo_url: null,
    sport: "football" as const,
    data_source: "demo" as const,
  };
}

// Kicked off an hour ago, so the result form is offered.
const MATCH: AdminMatch = {
  id: MATCH_ID,
  sport: "football",
  league: { id: FOOTBALL_ID, name: "Veikkausliiga" },
  season: "2026",
  start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  state: "upcoming",
  period: null,
  game_clock_seconds: null,
  home_team: team(OULU, "AC Oulu"),
  away_team: team(HJK, "HJK"),
  home_goals: null,
  away_goals: null,
  ended_in: null,
  featured: false,
  data_source: "admin",
  pick_count: 3,
  goals: [],
  top_scorer: null,
};

const OULU_PLAYERS: PlayerSummary[] = [
  {
    id: SCORER,
    first_name: "Eetu",
    last_name: "Ahola",
    jersey_number: 9,
    position: "forward",
    birth_year: null,
    season_goals: 2,
    goals_last_5: 1,
  },
];

function routes() {
  return {
    "/admin/leagues": LEAGUES,
    "/admin/matches": [MATCH],
    [`/teams/${OULU}/players`]: OULU_PLAYERS,
    [`/teams/${HJK}/players`]: [],
    "POST /admin/matches": MATCH,
    [`POST /admin/matches/${MATCH_ID}/result`]: { ...MATCH, state: "final" },
  };
}

function options_of(label: string): string[] {
  return within(screen.getByLabelText(label))
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
}

describe("AdminMatchesTab", () => {
  beforeEach(() => {
    save_session_token("token-1");
  });

  it("lists only the chosen league's teams", async () => {
    mock_api(routes());
    render_at(<AdminMatchesTab />);

    await screen.findByRole("option", { name: "Veikkausliiga" });
    expect(options_of("Home team")).toEqual(["Pick a team", "AC Oulu", "HJK"]);

    fireEvent.change(screen.getByLabelText("League"), { target: { value: BASKETBALL_ID } });
    expect(options_of("Away team")).toEqual(["Pick a team", "Karhu Basket"]);
  });

  it("creates a match with the league, both teams and the start time", async () => {
    const api = mock_api(routes());
    render_at(<AdminMatchesTab />);

    await screen.findByRole("option", { name: "Veikkausliiga" });
    fireEvent.change(screen.getByLabelText("Home team"), { target: { value: OULU } });
    fireEvent.change(screen.getByLabelText("Away team"), { target: { value: HJK } });
    fireEvent.change(screen.getByLabelText("Start time (your local time)"), {
      target: { value: "2026-10-25T18:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add match" }));

    await screen.findByText("Match added. Fans can pick it until the start time.");
    const created = api.requests.find((request) => request.method === "POST");
    expect(created?.body).toEqual({
      league_id: FOOTBALL_ID,
      home_team_id: OULU,
      away_team_id: HJK,
      start_time: new Date("2026-10-25T18:00").toISOString(),
    });
  });

  it("posts a football result with its goals", async () => {
    const api = mock_api(routes());
    render_at(<AdminMatchesTab />);

    const list = await screen.findByRole("list", { name: "Matches" });
    expect(await within(list).findByText(/3 picks/)).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "Enter result" }));
    fireEvent.change(screen.getByLabelText("AC Oulu score"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add goal" }));
    await screen.findByRole("option", { name: "Eetu Ahola" });
    fireEvent.change(screen.getByLabelText("Scorer"), { target: { value: SCORER } });
    fireEvent.change(screen.getByLabelText("Minute"), { target: { value: "62" } });
    fireEvent.click(screen.getByRole("button", { name: "Save result" }));

    await waitFor(() => {
      expect(api.requests.some((request) => request.path.endsWith("/result"))).toBe(true);
    });
    const result = api.requests.find((request) => request.path.endsWith("/result"));
    expect(result?.body).toEqual({
      home_goals: 1,
      away_goals: 0,
      goals: [{ team_id: OULU, player_id: SCORER, minute: 62 }],
    });
    await screen.findByText("Result saved. The match's picks are scored.");
  });
});
