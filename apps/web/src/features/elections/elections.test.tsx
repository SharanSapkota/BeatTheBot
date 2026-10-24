import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ElectionDetail, ElectionList, ElectionResults } from "@voita_kone/shared_types";
import { describe, expect, it, vi } from "vitest";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { ElectionPage } from "./election_page";
import { ElectionsPage } from "./elections_page";

// Fictional candidates only.
const ELECTION_ID = "e0000000-0000-4000-8000-000000000001";
const AINO = "c0000000-0000-4000-8000-000000000001";
const VEIKKO = "c0000000-0000-4000-8000-000000000002";
const USER = { id: "11111111-1111-4111-8111-111111111111", display_name: "Mika", role: "user" };

const SUMMARY = {
  id: ELECTION_ID,
  title: "Demo election",
  election_type: "municipal",
  area_type: "municipality",
  area_name: "Oulu",
  election_date: "2099-11-14",
  poll_opens_at: "2026-10-01T00:00:00.000Z",
  poll_closes_at: "2099-11-14T18:00:00.000Z",
  status: "published",
  is_poll_open: true,
  question_text: "Who will get the most votes in Oulu?",
  is_demo: true,
  candidate_count: 2,
} satisfies ElectionList["elections"][number];

const DETAIL: ElectionDetail = {
  ...SUMMARY,
  candidates: [
    {
      id: AINO,
      full_name: "Aino Esimerkki",
      party_or_group: "Demo List A",
      candidate_number: 12,
      short_bio: "Fictional demo candidate.",
      photo_url: null,
    },
    {
      id: VEIKKO,
      full_name: "Veikko Testinen",
      party_or_group: null,
      candidate_number: null,
      short_bio: "",
      photo_url: null,
    },
  ],
  my_pick: null,
  winner_candidate_id: null,
};

const HIDDEN: ElectionResults = {
  election_id: ELECTION_ID,
  total_picks: 30,
  min_picks: 20,
  hidden_reason: "pick_first",
  shares: null,
  winner_candidate_id: null,
  label_text: "Not a scientific poll. Shows only the picks of Voita Kaleva users.",
};

describe("ElectionsPage", () => {
  it("lists elections with the Demo badge and selects Oulu by default", async () => {
    mock_api({
      "/elections": {
        areas: ["Kuvitela", "Oulu"],
        elections: [SUMMARY, { ...SUMMARY, id: VEIKKO, title: "Other", area_name: "Kuvitela" }],
      },
    });
    render_at(<ElectionsPage />, { url: "/elections", path: "/elections" });

    const oulu = await screen.findByRole("button", { name: "Oulu" });
    expect(oulu).toHaveAttribute("aria-pressed", "true");
    const list = screen.getByRole("list", { name: "Elections" });
    expect(within(list).getAllByRole("link")).toHaveLength(1);
    expect(within(list).getByText("Demo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All areas" }));
    expect(within(list).getAllByRole("link")).toHaveLength(2);
  });
});

describe("ElectionPage", () => {
  it("asks for a name on the first pick, saves it, and shows the result bars and label", async () => {
    const api = mock_api({
      [`/elections/${ELECTION_ID}`]: DETAIL,
      [`/elections/${ELECTION_ID}/results`]: HIDDEN,
      "POST /auth/device": { token: "new-token", user: USER },
      [`POST /elections/${ELECTION_ID}/picks`]: {
        election_id: ELECTION_ID,
        candidate_id: AINO,
        points_awarded: null,
        created_at: "2026-10-24T12:00:00.000Z",
        updated_at: "2026-10-24T12:00:00.000Z",
      },
    });
    render_at(<ElectionPage />, {
      url: `/elections/${ELECTION_ID}`,
      path: "/elections/:election_id",
    });

    expect(
      await screen.findByRole("heading", { name: "Who will get the most votes in Oulu?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Make your prediction to see what other users picked.")).toBeVisible();
    expect(
      screen.getByText("Not a scientific poll. Shows only the picks of Voita Kaleva users."),
    ).toBeVisible();
    expect(screen.queryByText(/who will you vote for/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pick Aino Esimerkki" }));
    const dialog = await screen.findByRole("dialog", { name: "What should we call you?" });
    fireEvent.change(within(dialog).getByLabelText("Display name"), { target: { value: "Mika" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and pick" }));

    await waitFor(() => {
      const pick = api.requests.find(
        (request) => request.method === "POST" && request.path.endsWith("/picks"),
      );
      expect(pick?.body).toEqual({ candidate_id: AINO });
      expect(pick?.authorization).toBe("Bearer new-token");
    });
  });

  it("refetches the results after the first pick, even when a fetch from signing in is slow", async () => {
    const visible: ElectionResults = {
      ...HIDDEN,
      hidden_reason: null,
      shares: [
        { candidate_id: AINO, picks: 18, share: 0.6 },
        { candidate_id: VEIKKO, picks: 12, share: 0.4 },
      ],
    };
    const reply = (data: unknown, status = 200) =>
      Promise.resolve(
        new Response(JSON.stringify({ data }), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
    let has_picked = false;
    let release_slow_results: (() => void) | null = null;
    let signed_in_results_requests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, "");
        const method = init?.method ?? "GET";
        const signed_in = new Headers(init?.headers).has("authorization");
        if (method === "POST" && path === "/auth/device") {
          return reply({ token: "new-token", user: USER }, 201);
        }
        if (method === "POST" && path.endsWith("/picks")) {
          has_picked = true;
          // The results fetch started by signing in answers only after the pick is saved.
          setTimeout(() => release_slow_results?.(), 20);
          return reply(
            {
              election_id: ELECTION_ID,
              candidate_id: AINO,
              points_awarded: null,
              created_at: "2026-10-24T12:00:00.000Z",
              updated_at: "2026-10-24T12:00:00.000Z",
            },
            201,
          );
        }
        if (path.endsWith("/results")) {
          if (signed_in && !has_picked) {
            signed_in_results_requests += 1;
            return new Promise<Response>((resolve) => {
              release_slow_results = () => void reply(HIDDEN).then(resolve);
            });
          }
          if (signed_in) {
            signed_in_results_requests += 1;
          }
          return reply(has_picked ? visible : HIDDEN);
        }
        return reply(
          has_picked
            ? { ...DETAIL, my_pick: { candidate_id: AINO, points_awarded: null } }
            : DETAIL,
        );
      }),
    );
    render_at(<ElectionPage />, {
      url: `/elections/${ELECTION_ID}`,
      path: "/elections/:election_id",
    });

    fireEvent.click(await screen.findByRole("button", { name: "Pick Aino Esimerkki" }));
    const dialog = await screen.findByRole("dialog", { name: "What should we call you?" });
    fireEvent.change(within(dialog).getByLabelText("Display name"), { target: { value: "Mika" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and pick" }));

    expect(await screen.findByLabelText("Aino Esimerkki: 60% of picks (18)")).toBeVisible();
    expect(signed_in_results_requests).toBeGreaterThanOrEqual(2);
  });

  it("shows a bar per candidate in the same order once results are visible", async () => {
    mock_api({
      [`/elections/${ELECTION_ID}`]: {
        ...DETAIL,
        my_pick: { candidate_id: AINO, points_awarded: null },
      },
      [`/elections/${ELECTION_ID}/results`]: {
        ...HIDDEN,
        hidden_reason: null,
        shares: [
          { candidate_id: AINO, picks: 18, share: 0.6 },
          { candidate_id: VEIKKO, picks: 12, share: 0.4 },
        ],
      },
    });
    render_at(<ElectionPage />, {
      url: `/elections/${ELECTION_ID}`,
      path: "/elections/:election_id",
    });

    expect(await screen.findByLabelText("Aino Esimerkki: 60% of picks (18)")).toBeVisible();
    expect(screen.getByLabelText("Veikko Testinen: 40% of picks (12)")).toBeVisible();
    expect(screen.getByRole("button", { name: "Pick Aino Esimerkki" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says results show after 20 picks", async () => {
    mock_api({
      [`/elections/${ELECTION_ID}`]: DETAIL,
      [`/elections/${ELECTION_ID}/results`]: {
        ...HIDDEN,
        total_picks: 7,
        hidden_reason: "not_enough_picks",
      },
    });
    render_at(<ElectionPage />, {
      url: `/elections/${ELECTION_ID}`,
      path: "/elections/:election_id",
    });
    expect(await screen.findByText("Results show after 20 picks (7 so far).")).toBeVisible();
  });
});
