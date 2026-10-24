import { game_detail_schema, type GameSummary } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import {
  AWAY_TEAM,
  HOME_TEAM,
  build_game_row,
  build_goal,
  build_penalty,
  build_player_ref,
} from "../../test_helpers/game_rows";
import {
  build_game_events,
  order_game_day,
  to_game_detail,
  to_game_state,
  to_game_summary,
} from "./games_mapper";

const FEATURED = HOME_TEAM.external_id;

function summary(overrides: Partial<GameSummary>): GameSummary {
  return { ...to_game_summary(build_game_row(), "none"), ...overrides };
}

describe("to_game_state", () => {
  it("maps the stored status to the state the app shows", () => {
    expect(to_game_state("scheduled")).toBe("upcoming");
    expect(to_game_state("live")).toBe("live");
    expect(to_game_state("final")).toBe("final");
    expect(() => to_game_state("cancelled")).toThrow();
  });
});

describe("to_game_summary", () => {
  it("flags games of the featured team", () => {
    expect(to_game_summary(build_game_row(), FEATURED).featured).toBe(true);
    expect(to_game_summary(build_game_row(), "other:team").featured).toBe(false);
  });

  it("returns times as ISO UTC", () => {
    expect(to_game_summary(build_game_row(), FEATURED).start_time).toBe("2026-10-23T15:30:00.000Z");
  });
});

describe("order_game_day", () => {
  it("lists live, then upcoming by start time, then final, featured first in each group", () => {
    const games = [
      summary({ id: "final", state: "final", start_time: "2026-10-24T14:00:00.000Z" }),
      summary({ id: "upcoming_late", state: "upcoming", start_time: "2026-10-24T16:30:00.000Z" }),
      summary({ id: "upcoming_early", state: "upcoming", start_time: "2026-10-24T14:00:00.000Z" }),
      summary({
        id: "upcoming_featured",
        state: "upcoming",
        start_time: "2026-10-24T16:30:00.000Z",
        featured: true,
      }),
      summary({ id: "live", state: "live", start_time: "2026-10-24T15:00:00.000Z" }),
    ];

    expect(order_game_day(games).map((game) => game.id)).toEqual([
      "live",
      "upcoming_featured",
      "upcoming_early",
      "upcoming_late",
      "final",
    ]);
  });
});

describe("build_game_events", () => {
  const scorer = build_player_ref(9, "Päkkilä");
  const assist = build_player_ref(4, "Hirvonen");

  it("adds the running score after each goal and keeps time order", () => {
    const game = to_game_summary(build_game_row({ home_goals: 2, away_goals: 1 }), FEATURED);
    const events = build_game_events(game, [
      build_goal(HOME_TEAM, 1, 877, scorer, [assist]),
      build_penalty(AWAY_TEAM, 2, 1448),
      build_goal(AWAY_TEAM, 2, 1512),
      build_goal(HOME_TEAM, 3, 3063, scorer),
    ]);
    const goals = events.filter((event) => event.event_type === "goal");

    expect(goals.map((goal) => goal.score_after)).toEqual([
      { home: 1, away: 0 },
      { home: 1, away: 1 },
      { home: 2, away: 1 },
    ]);
    expect(goals[0]).toMatchObject({ player: scorer, assists: [assist] });
    expect(events.find((event) => event.event_type === "penalty")).toMatchObject({
      penalty_minutes: 2,
      score_after: null,
    });
  });

  it("adds an end for each finished period, after events at the same second", () => {
    const game = to_game_summary(build_game_row(), FEATURED);
    const events = build_game_events(game, [build_goal(HOME_TEAM, 1, 1200)]);

    expect(events.map((event) => [event.event_type, event.game_time_seconds])).toEqual([
      ["goal", 1200],
      ["period_end", 1200],
      ["period_end", 2400],
      ["period_end", 3600],
    ]);
  });

  it("ends overtime only when the game went to a shootout", () => {
    const overtime = to_game_summary(build_game_row({ ended_in: "overtime", period: 4 }), FEATURED);
    const shootout = to_game_summary(build_game_row({ ended_in: "shootout", period: 5 }), FEATURED);

    expect(build_game_events(overtime, []).map((event) => event.id)).toEqual([
      "period_end_1",
      "period_end_2",
      "period_end_3",
    ]);
    expect(build_game_events(shootout, []).at(-1)).toMatchObject({
      id: "period_end_4",
      game_time_seconds: 3900,
    });
  });

  it("ends only the periods before the current one in a live game", () => {
    const live = to_game_summary(
      build_game_row({ status: "live", period: 2, game_clock_seconds: 1961, ended_in: null }),
      FEATURED,
    );

    expect(build_game_events(live, []).map((event) => event.id)).toEqual(["period_end_1"]);
  });

  it("builds a detail that matches the shared schema", () => {
    const game = to_game_summary(build_game_row(), FEATURED);
    const detail = to_game_detail(game, [build_goal(HOME_TEAM, 1, 877, scorer, [assist])]);

    expect(game_detail_schema.parse(detail)).toEqual(detail);
    expect(detail.demo_replay).toBe(false);
  });
});
