import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type {
  RoomCurrent,
  RoomDetail,
  RoomLeaderboard,
  RoomRevealedQuestion,
} from "@voita_kone/shared_types";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { save_session_token } from "../../lib/session";
import { mock_api } from "../../test_helpers/mock_api";
import { render_at } from "../../test_helpers/render_app";
import { JoinKeyInput, clean_key } from "./join_key_input";
import { RoomPage } from "./room_page";
import { RoomsPage } from "./rooms_page";

const ROOM_ID = "a0000000-0000-4000-8000-000000000001";
const ME = "b0000000-0000-4000-8000-000000000001";
const OTHER = "b0000000-0000-4000-8000-000000000002";
const USER = { id: ME, display_name: "Mika", role: "user" };

const ROOM: RoomDetail = {
  id: ROOM_ID,
  name: "Kärpät fans",
  topic: "hockey",
  status: "active",
  is_demo: false,
  question_interval_seconds: 60,
  member_count: 2,
  my_role: "member",
  my_rank: 1,
  my_points: 3,
  join_key: "K7RP4T",
  max_members: 100,
  owner_id: OTHER,
  created_at: "2026-10-24T12:00:00.000Z",
  members: [
    {
      user_id: OTHER,
      display_name: "Owner",
      role: "owner",
      joined_at: "2026-10-24T12:00:00.000Z",
      is_me: false,
    },
    {
      user_id: ME,
      display_name: "Mika",
      role: "member",
      joined_at: "2026-10-24T12:01:00.000Z",
      is_me: true,
    },
  ],
};

const CURRENT: RoomCurrent = {
  question: {
    id: "d0000000-0000-4000-8000-000000000002",
    room_id: ROOM_ID,
    slot_index: 1,
    question_type: "opinion",
    prompt: "Best Finnish hockey player of all time?",
    options: [
      { id: "a", label: "Teemu Selänne" },
      { id: "b", label: "Jari Kurri" },
    ],
    points: 1,
    opens_at: "2026-10-24T12:01:00.000Z",
    locks_at: "2026-10-24T12:02:00.000Z",
    answer_count: 1,
    my_answer: null,
    seconds_left: 42,
    member_count: 2,
  },
};

const REACTIONS = (["🔥", "😂", "😮", "👏", "😡"] as const).map((emoji) => ({
  emoji,
  count: 0,
  mine: false,
}));

const REVEALED: RoomRevealedQuestion = {
  id: "d0000000-0000-4000-8000-000000000001",
  room_id: ROOM_ID,
  slot_index: 0,
  question_type: "trivia",
  prompt: "Which city is Kärpät's home?",
  options: [
    { id: "b", label: "Kuopio" },
    { id: "a", label: "Oulu" },
  ],
  points: 3,
  opens_at: "2026-10-24T12:00:00.000Z",
  locks_at: "2026-10-24T12:01:00.000Z",
  answer_count: 2,
  my_answer: "a",
  correct_option: "a",
  split: [
    { option_id: "b", count: 1, share: 0.5 },
    { option_id: "a", count: 1, share: 0.5 },
  ],
  right_names: ["Mika"],
  my_points: 3,
  reactions: REACTIONS,
};

const BOARD: RoomLeaderboard = {
  period: "week",
  rows: [
    { rank: 1, kind: "you", display_name: "Mika", points: 3, answers: 1, correct_share: 1 },
    { rank: 2, kind: "user", display_name: "Owner", points: 0, answers: 1, correct_share: 0 },
  ],
};

function room_routes() {
  return {
    "/me": { ...USER, total_points: 0 },
    [`/rooms/${ROOM_ID}`]: ROOM,
    [`/rooms/${ROOM_ID}/current_question`]: CURRENT,
    [`/rooms/${ROOM_ID}/questions?limit=5`]: [REVEALED],
    [`/rooms/${ROOM_ID}/leaderboard?period=week`]: BOARD,
  };
}

function KeyHarness() {
  const [value, set_value] = useState("");
  return <JoinKeyInput value={value} on_change={set_value} />;
}

describe("join key input", () => {
  it("keeps 6 letters and digits in upper case", () => {
    expect(clean_key("k7-rp 4t9")).toBe("K7RP4T");
  });

  it("fills every box from a pasted or typed key", () => {
    render_at(<KeyHarness />);
    const first = screen.getByLabelText("Key character 1 of 6");
    fireEvent.change(first, { target: { value: "k7rp4t" } });
    const boxes = within(
      screen.getByRole("group", { name: "Room key, 6 characters" }),
    ).getAllByRole("textbox");
    expect(boxes.map((box) => (box as HTMLInputElement).value).join("")).toBe("K7RP4T");
  });
});

describe("RoomsPage", () => {
  it("asks for a name, then joins with the key in upper case", async () => {
    const api = mock_api({
      "POST /auth/device": { token: "new-token", user: USER },
      "POST /rooms/join": ROOM,
    });
    render_at(<RoomsPage />, { url: "/rooms", path: "/rooms" });

    expect(screen.getByRole("heading", { name: "No rooms yet" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Key character 1 of 6"), {
      target: { value: "k7rp4t" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    const dialog = await screen.findByRole("dialog", { name: "What should we call you?" });
    fireEvent.change(within(dialog).getByLabelText("Display name"), { target: { value: "Mika" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and join" }));

    await waitFor(() => {
      const join = api.requests.find((request) => request.path === "/rooms/join");
      expect(join?.body).toEqual({ key: "K7RP4T" });
      expect(join?.authorization).toBe("Bearer new-token");
    });
  });

  it("lists my rooms with members and my rank", async () => {
    save_session_token("token");
    mock_api({
      "/me": { ...USER, total_points: 0 },
      "/me/rooms": [ROOM],
    });
    render_at(<RoomsPage />, { url: "/rooms", path: "/rooms" });
    const list = await screen.findByRole("list", { name: "My rooms" });
    expect(within(list).getByText("Kärpät fans")).toBeInTheDocument();
    expect(within(list).getByText("Hockey · 2 members")).toBeInTheDocument();
    expect(within(list).getByText("You are #1")).toBeInTheDocument();
  });
});

describe("RoomPage", () => {
  it("shows the open question with a countdown, the reveal and the scoreboard", async () => {
    save_session_token("token");
    mock_api(room_routes());
    render_at(<RoomPage />, { url: `/rooms/${ROOM_ID}`, path: "/rooms/:room_id" });

    expect(await screen.findByRole("heading", { name: "Kärpät fans" })).toBeInTheDocument();
    expect(await screen.findByText("Best Finnish hockey player of all time?")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/Reveal in 0:4\d/);
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();

    const revealed = await screen.findByRole("article", { name: "Which city is Kärpät's home?" });
    expect(within(revealed).getByText("Right! +3 pts")).toBeInTheDocument();
    expect(within(revealed).getByText(/Right: Mika/)).toBeInTheDocument();

    const board = await screen.findByRole("list", { name: "Scoreboard" });
    expect(within(board).getByText("YOU")).toBeInTheDocument();
    expect(within(board).getByText("3 pts")).toBeInTheDocument();
  });

  it("sends the answer and toggles a reaction", async () => {
    save_session_token("token");
    const api = mock_api({
      ...room_routes(),
      [`POST /room_questions/${CURRENT.question?.id ?? ""}/answers`]: {
        question_id: CURRENT.question?.id,
        option: "a",
        answered_at: "2026-10-24T12:01:20.000Z",
      },
      [`POST /room_questions/${REVEALED.id}/reactions`]: {
        question_id: REVEALED.id,
        reactions: REACTIONS.map((row) =>
          row.emoji === "🔥" ? { ...row, count: 1, mine: true } : row,
        ),
      },
    });
    render_at(<RoomPage />, { url: `/rooms/${ROOM_ID}`, path: "/rooms/:room_id" });

    const answers = await screen.findByRole("group", { name: "Your answer" });
    fireEvent.click(within(answers).getByRole("button", { name: "Teemu Selänne" }));
    await waitFor(() => {
      const sent = api.requests.find((request) => request.path.endsWith("/answers"));
      expect(sent?.body).toEqual({ option: "a" });
    });

    const fire = await screen.findByRole("button", { name: "React 🔥 (0)" });
    fireEvent.click(fire);
    expect(await screen.findByRole("button", { name: "React 🔥 (1)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says the room is private for a non-member", async () => {
    save_session_token("token");
    mock_api(
      { "/me": { ...USER, total_points: 0 } },
      { [`/rooms/${ROOM_ID}`]: { status: 403, code: "NOT_A_MEMBER" } },
    );
    render_at(<RoomPage />, { url: `/rooms/${ROOM_ID}`, path: "/rooms/:room_id" });
    expect(
      await screen.findByRole("heading", { name: "This room is private" }),
    ).toBeInTheDocument();
  });
});
