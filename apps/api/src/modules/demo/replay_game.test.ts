import { game_detail_schema, type GameDetail } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import {
  AWAY_TEAM,
  HOME_TEAM,
  build_game_row,
  build_goal,
  build_penalty,
} from "../../test_helpers/game_rows";
import { to_game_detail, to_game_summary } from "../games/games_mapper";
import { LIVE_TARGET_SECONDS, choose_live_cut, period_at, replay_game } from "./replay_game";

// A real-looking 4-2 final.
function build_final(goal_times: { team: "home" | "away"; period: number; time: number }[]) {
  const home_goals = goal_times.filter((goal) => goal.team === "home").length;
  const away_goals = goal_times.length - home_goals;
  const game = to_game_summary(build_game_row({ home_goals, away_goals }), "none");
  const rows = [
    ...goal_times.map((goal) =>
      build_goal(goal.team === "home" ? HOME_TEAM : AWAY_TEAM, goal.period, goal.time),
    ),
    build_penalty(AWAY_TEAM, 2, 1448),
  ];
  return to_game_detail(game, rows);
}

const FINAL = build_final([
  { team: "home", period: 1, time: 412 },
  { team: "away", period: 1, time: 528 },
  { team: "home", period: 2, time: 1700 },
  { team: "home", period: 2, time: 2200 },
  { team: "away", period: 3, time: 2900 },
  { team: "home", period: 3, time: 3407 },
]);

function shown_goals(detail: GameDetail, side: "home" | "away") {
  const team_id = side === "home" ? detail.home_team.id : detail.away_team.id;
  return detail.events.filter((event) => event.event_type === "goal" && event.team_id === team_id)
    .length;
}

describe("replay_game", () => {
  it("before: shows the game as upcoming with no score and no events", () => {
    const before = replay_game(FINAL, "before");

    expect(before).toMatchObject({
      state: "upcoming",
      home_goals: null,
      away_goals: null,
      ended_in: null,
      period: null,
      game_clock_seconds: null,
      events: [],
      demo_replay: true,
    });
  });

  it("live: stops at 2nd period 12:41 and the score equals the goals shown", () => {
    const live = replay_game(FINAL, "live");

    expect(live).toMatchObject({
      state: "live",
      period: 2,
      game_clock_seconds: LIVE_TARGET_SECONDS,
      ended_in: null,
      demo_replay: true,
    });
    expect(live.events.every((event) => event.game_time_seconds <= LIVE_TARGET_SECONDS)).toBe(true);
    expect(live.home_goals).toBe(shown_goals(live, "home"));
    expect(live.away_goals).toBe(shown_goals(live, "away"));
    expect([live.home_goals, live.away_goals]).toEqual([2, 1]);
    expect(live.events.map((event) => event.id)).toContain("period_end_1");
  });

  it("final: shows the real result and every event", () => {
    const final = replay_game(FINAL, "final");

    expect(final).toMatchObject({
      state: "final",
      home_goals: 4,
      away_goals: 2,
      demo_replay: true,
    });
    expect(final.events).toEqual(FINAL.events);
    expect(final.home_goals).toBe(shown_goals(final, "home"));
    expect(final.away_goals).toBe(shown_goals(final, "away"));
  });

  it("keeps every moment valid against the shared schema", () => {
    for (const moment of ["before", "live", "final"] as const) {
      expect(game_detail_schema.safeParse(replay_game(FINAL, moment)).success).toBe(true);
    }
  });
});

describe("choose_live_cut", () => {
  it("uses 2nd period 12:41 when both teams have scored by then", () => {
    expect(choose_live_cut(FINAL)).toBe(LIVE_TARGET_SECONDS);
  });

  it("moves later until both teams have a goal", () => {
    const late_away_goal = build_final([
      { team: "home", period: 1, time: 412 },
      { team: "away", period: 3, time: 2900 },
    ]);

    const live = replay_game(late_away_goal, "live");

    expect(choose_live_cut(late_away_goal)).toBe(2900);
    expect(live).toMatchObject({ period: 3, home_goals: 1, away_goals: 1 });
  });

  it("stays at 2nd period 12:41 when one team never scores", () => {
    const shutout = build_final([{ team: "home", period: 1, time: 412 }]);

    expect(choose_live_cut(shutout)).toBe(LIVE_TARGET_SECONDS);
  });
});

describe("period_at", () => {
  it("maps game time to the period", () => {
    expect(period_at(0)).toBe(1);
    expect(period_at(1961)).toBe(2);
    expect(period_at(3599)).toBe(3);
    expect(period_at(3700)).toBe(4);
    expect(period_at(3900)).toBe(5);
  });
});
