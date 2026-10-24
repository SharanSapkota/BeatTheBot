import { describe, expect, it } from "vitest";
import { game_day_schema, game_detail_schema, type GameSummary } from "./games";

const team = {
  id: "8d1f2c3a-1b2c-4d5e-8f90-1234567890ab",
  external_id: "495643563:kärpät",
  name: "Kärpät",
  short_name: "KÄR",
  city: "Oulu",
  logo_url: null,
  sport: "hockey",
  data_source: "liiga_api",
} as const;

const game: GameSummary = {
  id: "0b6f6f3e-6a5e-4f43-9b3e-7f2d5c1a9e10",
  sport: "hockey",
  league: { id: "00000000-0000-4000-8000-000000000001", name: "Liiga" },
  season: "2026-27",
  start_time: "2026-10-24T14:00:00.000Z",
  state: "live",
  period: 2,
  game_clock_seconds: 1961,
  home_team: team,
  away_team: { ...team, id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", name: "KalPa" },
  home_goals: 1,
  away_goals: 1,
  ended_in: null,
  featured: true,
  data_source: "liiga_api",
};

describe("game_day_schema", () => {
  it("accepts a game day", () => {
    const game_day = { date: "2026-10-24", games: [game], demo_replay: false };

    expect(game_day_schema.parse(game_day)).toEqual(game_day);
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    expect(
      game_day_schema.safeParse({ date: "24.10.2026", games: [], demo_replay: false }).success,
    ).toBe(false);
  });
});

describe("game_detail_schema", () => {
  it("accepts derived period-end events and goals with a running score", () => {
    const detail = {
      ...game,
      demo_replay: false,
      top_scorer: null,
      events: [
        {
          id: "period_end_1",
          event_type: "period_end",
          period: 1,
          game_time_seconds: 1200,
          team_id: null,
          player: null,
          assists: [],
          penalty_minutes: null,
          score_after: null,
        },
      ],
    };

    expect(game_detail_schema.parse(detail)).toEqual(detail);
  });

  it("rejects an unknown state", () => {
    expect(
      game_detail_schema.safeParse({ ...game, state: "paused", events: [], demo_replay: false })
        .success,
    ).toBe(false);
  });
});

describe("sport fields", () => {
  it("accepts a football game with a draw and admin-entered data", () => {
    const football = {
      ...game,
      sport: "football",
      data_source: "admin",
      home_goals: 2,
      away_goals: 2,
    };
    expect(
      game_day_schema.parse({ date: "2026-10-24", games: [football], demo_replay: false }).games[0]
        ?.sport,
    ).toBe("football");
  });

  it("rejects an unknown sport", () => {
    expect(
      game_day_schema.safeParse({
        date: "2026-10-24",
        games: [{ ...game, sport: "curling" }],
        demo_replay: false,
      }).success,
    ).toBe(false);
  });
});
