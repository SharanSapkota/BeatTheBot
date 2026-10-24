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

/** A home win 3–1 on the given day; the AI picked `ai_winner` (or nothing). */
function game(id: string, start_iso: string, ai_winner: string | null): LeaderboardGame {
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
    ai_pick:
      ai_winner === null
        ? null
        : { winner_team_id: ai_winner, home_goals: 2, away_goals: 1, scorer_id: null },
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
  it("shares a rank on equal points and puts users before the AI on a tie", () => {
    const ranked = rank_entries([
      { kind: "user", id: "a", display_name: "a", points: 20 },
      { kind: "ai", id: "ai", display_name: "Kaleva AI", points: 30 },
      { kind: "user", id: "b", display_name: "b", points: 30 },
      { kind: "user", id: "c", display_name: "c", points: 10 },
    ]);

    expect(ranked.map((entry) => [entry.id, entry.rank])).toEqual([
      ["b", 1],
      ["ai", 1],
      ["a", 3],
      ["c", 4],
    ]);
  });
});

describe("build_leaderboard", () => {
  const games = [
    game("this_week", "2026-10-23T16:30:00.000Z", AWAY), // AI wrong
    game("last_week", "2026-10-16T16:30:00.000Z", HOME), // AI right: 10 points
  ];
  const picks = [
    pick("mika", "this_week", HOME, 35),
    pick("sanna", "this_week", AWAY, 0),
    pick("mika", "last_week", HOME, 10),
    pick("sanna", "last_week", HOME, 25),
  ];

  it("counts only this week's games for the week", () => {
    const board = build_leaderboard(input({ games, picks, me_user_id: "sanna" }));

    expect(board.rows).toEqual([
      { rank: 1, kind: "user", display_name: "mika", points: 35, movement: null },
      { rank: 2, kind: "you", display_name: "sanna", points: 0, movement: null },
      { rank: 2, kind: "ai", display_name: "Kaleva AI", points: 0, movement: null },
    ]);
    expect(board.accuracy).toEqual({ you: 0, ai: 0, fans: 0.5 });
    expect(board.game_count).toBe(1);
  });

  it("counts all games for the season and gives the AI its own points", () => {
    const board = build_leaderboard(input({ period: "season", games, picks, me_user_id: "mika" }));

    expect(board.rows.map((row) => [row.kind, row.display_name, row.points])).toEqual([
      ["you", "mika", 45],
      ["user", "sanna", 25],
      ["ai", "Kaleva AI", 10],
    ]);
    expect(board.accuracy).toEqual({ you: 1, ai: 0.5, fans: 0.75 });
  });

  it("gives null accuracy (not 0%) and no week comparison without AI picks", () => {
    const board = build_leaderboard(
      input({ games: [game("g", "2026-10-23T16:30:00.000Z", null)], picks: [] }),
    );

    expect(board.accuracy).toEqual({ you: null, ai: null, fans: null });
    expect(board.compared_weeks).toBe(0);
    expect(board.game_count).toBe(0);
  });

  it("has no 'you' row and null accuracy when signed out", () => {
    const board = build_leaderboard(input({ games, picks }));

    expect(board.rows.some((row) => row.kind === "you")).toBe(false);
    expect(board.accuracy.you).toBeNull();
  });

  it("compares the last full weeks: fans 100% vs AI 100% last week is not a win", () => {
    const board = build_leaderboard(input({ games, picks }));

    expect(board.compared_weeks).toBe(1);
    expect(board.fans_beat_ai_weeks).toBe(0);
  });

  it("shows the top 10, plus the AI and 'you' rows when they rank lower", () => {
    const many_games = [game("g", "2026-10-23T16:30:00.000Z", AWAY)];
    const many_picks = Array.from({ length: 12 }, (_, index) =>
      pick(`user_${String(index).padStart(2, "0")}`, "g", HOME, 100 - index),
    );
    many_picks.push(pick("me", "g", AWAY, 1));

    const board = build_leaderboard(
      input({ games: many_games, picks: many_picks, me_user_id: "me" }),
    );

    expect(board.rows).toHaveLength(12);
    expect(board.rows.at(-2)).toMatchObject({ kind: "you", rank: 13, points: 1 });
    expect(board.rows.at(-1)).toMatchObject({ kind: "ai", rank: 14, points: 0 });
  });

  it("gives 'you' the places gained since the last game day", () => {
    const two_days = [
      game("thursday", "2026-10-22T16:30:00.000Z", null),
      game("friday", "2026-10-23T16:30:00.000Z", null),
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
