import { describe, expect, it } from "vitest";
import {
  build_leaderboard,
  rank_entries,
  type LeaderboardGame,
  type LeaderboardInput,
  type LeaderboardPick,
} from "./leaderboard_builder";
import { week_monday } from "./leaderboard_week";

// Saturday 24 Oct 2026, 15:00 Helsinki. This week started Monday 19 Oct.
const NOW = new Date("2026-10-24T12:00:00.000Z");
const HOME = "home";
const AWAY = "away";
const PRIZE = { title: "Prize", note: "Note" };

/** A home win 3–1 on the given day. */
function game(id: string, start_iso: string): LeaderboardGame {
  return {
    id,
    start_time: new Date(start_iso),
    result: {
      home_team_id: HOME,
      away_team_id: AWAY,
      home_goals: 3,
      away_goals: 1,
      ended_in: "regulation",
      goals: [],
    },
  };
}

function pick(user_id: string, game_id: string, winner: string, points: number): LeaderboardPick {
  return {
    user_id,
    display_name: user_id,
    game_id,
    winner_team_id: winner,
    points_awarded: points,
  };
}

function input(change: Partial<LeaderboardInput>): LeaderboardInput {
  return {
    period: "week",
    sport: "all",
    now: NOW,
    games: [],
    picks: [],
    me_user_id: null,
    prize: PRIZE,
    ...change,
  };
}

describe("week_monday", () => {
  it("is the Helsinki Monday, also late on Sunday evening UTC", () => {
    expect(week_monday(NOW)).toBe("2026-10-19");
    // Sunday 25 Oct 23:30 UTC is already Monday 26 Oct in Helsinki.
    expect(week_monday(new Date("2026-10-25T23:30:00.000Z"))).toBe("2026-10-26");
  });
});

describe("rank_entries", () => {
  it("shares a rank on equal points (1, 2, 2, 4)", () => {
    const ranked = rank_entries([
      { id: "a", display_name: "Anna", points: 30 },
      { id: "b", display_name: "Bea", points: 20 },
      { id: "c", display_name: "Cecilia", points: 20 },
      { id: "d", display_name: "Dina", points: 5 },
    ]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 2, 4]);
  });
});

describe("build_leaderboard", () => {
  const games = [
    game("this_week", "2026-10-23T16:30:00.000Z"),
    game("last_week", "2026-10-16T16:30:00.000Z"),
  ];
  const picks = [
    pick("mika", "this_week", HOME, 10),
    pick("sanna", "this_week", AWAY, 0),
    pick("mika", "last_week", HOME, 35),
  ];

  it("ranks only real users: no AI row, no 'all fans' row", () => {
    const board = build_leaderboard(input({ games, picks, period: "season" }));
    expect(board.rows.map((row) => [row.kind, row.display_name, row.points])).toEqual([
      ["user", "mika", 45],
      ["user", "sanna", 0],
    ]);
  });

  it("counts only this week's games for the week, with the fans' accuracy", () => {
    const board = build_leaderboard(input({ games, picks, me_user_id: "sanna" }));
    expect(board.rows.map((row) => [row.kind, row.points])).toEqual([
      ["user", 10],
      ["you", 0],
    ]);
    expect(board.summary).toEqual({ you_accuracy: 0, fans_accuracy: 0.5, games_count: 1 });
  });

  it("gives null accuracy (not 0%) and no 'you' row when signed out without picks", () => {
    const board = build_leaderboard(input({ games }));
    expect(board.summary).toEqual({ you_accuracy: null, fans_accuracy: null, games_count: 1 });
    expect(board.rows).toEqual([]);
  });

  it("shows the top 10, plus the 'you' row when it ranks lower", () => {
    const many_picks = Array.from({ length: 12 }, (_, index) =>
      pick(`user_${String(index).padStart(2, "0")}`, "this_week", HOME, 100 - index),
    );
    many_picks.push(pick("me", "this_week", AWAY, 1));

    const board = build_leaderboard(input({ games, picks: many_picks, me_user_id: "me" }));

    expect(board.rows).toHaveLength(11);
    expect(board.rows.at(-1)).toMatchObject({ kind: "you", rank: 13, points: 1 });
  });

  it("gives 'you' the places gained since the last game day", () => {
    const two_days = [
      game("thursday", "2026-10-22T16:30:00.000Z"),
      game("friday", "2026-10-23T16:30:00.000Z"),
    ];
    const day_picks = [
      pick("mika", "thursday", HOME, 30),
      pick("me", "thursday", HOME, 10),
      pick("me", "friday", HOME, 35),
    ];

    const board = build_leaderboard(input({ games: two_days, picks: day_picks, me_user_id: "me" }));

    expect(board.rows.find((row) => row.kind === "you")).toMatchObject({ rank: 1, movement: 1 });
  });
});
