import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { EditorStory, UserSummary } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { save_session_token } from "../../lib/session";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { AdminPage } from "../admin/admin_page";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const STORY_ID = "22222222-2222-4222-8222-222222222222";

function make_user(role: UserSummary["role"]): UserSummary {
  return { id: USER_ID, display_name: "Toimittaja", role, total_points: 0 };
}

const STORY: EditorStory = {
  id: STORY_ID,
  game_id: "33333333-3333-4333-8333-333333333333",
  game: "Kärpät vs KalPa",
  start_time: "2026-10-24T15:00:00.000Z",
  story_type: "summary",
  headline: "Kärpät beat KalPa",
  body: "Kärpät beat KalPa 3–1 at home. Niemi scored twice. Attendance was 9 000.",
  traffic_light: "yellow",
  reasons: ["AI story"],
  source: "llm",
  claims: [
    { claim: "3–1", type: "score", status: "verified", fact_ids: ["F1"], reason: null },
    {
      claim: "Niemi scored twice",
      type: "player",
      status: "wrong",
      fact_ids: ["F2"],
      reason: "Niemi scored once",
    },
    { claim: "9 000", type: "number", status: "not_found", fact_ids: [], reason: "No fact" },
  ],
  facts: [
    { fact_id: "F1", type: "score", value: { home_goals: 3, away_goals: 1 }, source: "liiga_api" },
    { fact_id: "F2", type: "goals", value: { player: "Niemi", goals: 1 }, source: "liiga_api" },
    { fact_id: "F3", type: "standing", value: { position: 4 }, source: "liiga_api" },
  ],
  reports: [{ reason: "Wrong scorer", created_at: "2026-10-24T18:00:00.000Z" }],
  was_published: false,
  created_at: "2026-10-24T17:30:00.000Z",
};

/** /admin?tab=stories: the Stories tab (role editor or admin). */
function render_stories_tab() {
  return render_at(<AdminPage />, { url: "/admin?tab=stories", path: "/admin" });
}

describe("/admin → Stories", () => {
  it("shows Staff only when signed out", async () => {
    mock_api({});
    render_stories_tab();

    expect(await screen.findByRole("heading", { name: "Staff only" })).toBeInTheDocument();
  });

  it("shows Staff only with the user id for a normal user, and no queue request", async () => {
    save_session_token("token-1");
    const api = mock_api({ "/me": make_user("user") });
    render_stories_tab();

    expect(await screen.findByRole("heading", { name: "Staff only" })).toBeInTheDocument();
    expect(screen.getByText(`Your user id: ${USER_ID}`)).toBeInTheDocument();
    expect(api.requested_paths).not.toContain("/admin/stories");
  });

  it("gives an editor only the Stories tab and filters the queue by traffic light", async () => {
    save_session_token("token-1");
    const api = mock_api({
      "/me": make_user("editor"),
      "/admin/stories": [STORY],
      "/admin/stories?status=red": [],
    });
    render_at(<AdminPage />, { url: "/admin", path: "/admin" });

    const tabs = await screen.findByRole("tablist", { name: "Admin sections" });
    expect(tabs).toHaveTextContent("Stories");
    expect(tabs).not.toHaveTextContent("Elections");
    fireEvent.click(await screen.findByRole("tab", { name: "🔴 Red" }));
    expect(await screen.findByRole("heading", { name: "The queue is empty" })).toBeInTheDocument();
    expect(api.requested_paths).toContain("/admin/stories?status=red");
  });

  it("shows the queue with claims marked and approves the story", async () => {
    save_session_token("token-1");
    const api = mock_api({
      "/me": make_user("editor"),
      "/admin/stories": [STORY],
      [`POST /admin/stories/${STORY_ID}/approve`]: {
        id: STORY_ID,
        status: "published",
        label_text: "AI-written from Liiga data.",
      },
    });
    render_stories_tab();

    expect(
      await screen.findByRole("button", { name: "Kärpät vs KalPa · summary" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 open reader report")).toBeInTheDocument();

    const marks = Array.from(document.querySelectorAll("mark"));
    expect(marks.map((mark) => mark.dataset.status)).toEqual(["verified", "wrong", "not_found"]);
    expect(marks[1]).toHaveTextContent("Niemi scored twice");

    const cited = Array.from(document.querySelectorAll("[data-cited='true'] code"));
    expect(cited.map((element) => element.textContent)).toEqual(["F1", "F2"]);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(
        api.requests.some(
          (request) =>
            request.method === "POST" && request.path === `/admin/stories/${STORY_ID}/approve`,
        ),
      ).toBe(true);
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Published: Kärpät beat KalPa");
    await waitFor(() => {
      expect(api.requested_paths.filter((path) => path === "/admin/stories")).toHaveLength(2);
    });
  });

  it("shows the fact checker's message when an edit is refused", async () => {
    save_session_token("token-1");
    const api = mock_api(
      { "/me": make_user("admin"), "/admin/stories": [STORY] },
      { [`PUT /admin/stories/${STORY_ID}`]: { status: 422, code: "CHECK_FAILED" } },
    );
    render_stories_tab();

    fireEvent.click(await screen.findByRole("button", { name: "Edit and approve" }));
    const textarea = screen.getByLabelText("Story text");
    expect(textarea).toHaveValue(STORY.body);
    fireEvent.change(screen.getByLabelText("What was wrong (optional)"), {
      target: { value: "Wrong scorer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The fact checker refused the text");
    const edit_request = api.requests.find((request) => request.method === "PUT");
    expect(edit_request?.body).toEqual({ body: STORY.body, note: "Wrong scorer" });
  });
});
