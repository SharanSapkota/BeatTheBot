import { describe, expect, it } from "vitest";
import {
  SAMPLE_DAYS_AHEAD,
  demo_result,
  finish_sample_game,
  parse_sample_id,
  plan_sample_games,
} from "./demo_refresh";

const FOOTBALL_ID = "demo:football:2026-10-24:ac_oulu-hjk";
const BASKETBALL_ID = "demo:basketball:2026-10-24:karhu-kataja";

describe("parse_sample_id", () => {
  it("reads the sport and the teams of a sample game", () => {
    expect(parse_sample_id(FOOTBALL_ID)).toEqual({
      sport: "football",
      home: "ac_oulu",
      away: "hjk",
    });
    expect(parse_sample_id("demo_final")).toBeNull();
    expect(parse_sample_id("123:liiga")).toBeNull();
  });
});

describe("demo_result", () => {
  it("gives the same result for the same game", () => {
    expect(demo_result(FOOTBALL_ID, "football")).toEqual(demo_result(FOOTBALL_ID, "football"));
  });

  it("lists one goal per football goal, by forwards, in minute order", () => {
    for (let index = 0; index < 50; index += 1) {
      const result = demo_result(`demo:football:2026-10-${String(index)}:hjk-kups`, "football");
      expect(result.goals).toHaveLength(result.home + result.away);
      expect(result.goals.filter((goal) => goal.side === "home")).toHaveLength(result.home);
      const minutes = result.goals.map((goal) => goal.minute);
      expect([...minutes].sort((first, second) => first - second)).toEqual(minutes);
      expect(minutes.every((minute) => minute >= 1 && minute <= 90)).toBe(true);
      expect(result.goals.every((goal) => goal.scorer >= 2 && goal.scorer <= 4)).toBe(true);
    }
  });

  it("never ends a basketball game in a tie; the top scorer is on the winning side", () => {
    for (let index = 0; index < 50; index += 1) {
      const result = demo_result(
        `demo:basketball:2026-10-${String(index)}:karhu-kataja`,
        "basketball",
      );
      expect(result.home).not.toBe(result.away);
      expect(result.top_scorer?.side).toBe(result.home > result.away ? "home" : "away");
    }
  });
});

describe("finish_sample_game", () => {
  it("keeps the id and start and adds the final score", () => {
    const start = new Date("2026-10-24T15:00:00Z");
    const final = finish_sample_game(BASKETBALL_ID, start);
    expect(final).toMatchObject({ external_id: BASKETBALL_ID, start_time: start, status: "final" });
    expect(final?.top_scorer_external_id).toMatch(/^demo:korisliiga:/);
    expect(finish_sample_game("demo_final", start)).toBeNull();
  });
});

describe("plan_sample_games", () => {
  // 12:00 Helsinki on Saturday 24 Oct.
  const now = new Date("2026-10-24T09:00:00Z");

  it("gives every sport one game a day for the coming week", () => {
    const games = plan_sample_games(now, new Set());
    expect(games.filter((game) => game.sport === "football")).toHaveLength(SAMPLE_DAYS_AHEAD);
    expect(games.filter((game) => game.sport === "basketball")).toHaveLength(SAMPLE_DAYS_AHEAD);
    expect(games.every((game) => game.status === "scheduled" && game.start_time > now)).toBe(true);
    expect(games.every((game) => game.home_team_external_id !== game.away_team_external_id)).toBe(
      true,
    );
  });

  it("leaves days that already have a game alone", () => {
    const games = plan_sample_games(now, new Set(["football:2026-10-24", "football:2026-10-25"]));
    const football_days = games
      .filter((game) => game.sport === "football")
      .map((game) => game.external_id.split(":")[2]);
    expect(football_days).not.toContain("2026-10-24");
    expect(football_days).toHaveLength(SAMPLE_DAYS_AHEAD - 2);
  });

  it("skips today once its kick-off has passed", () => {
    const evening = new Date("2026-10-24T17:00:00Z");
    const games = plan_sample_games(evening, new Set());
    expect(games.filter((game) => game.sport === "football")).toHaveLength(SAMPLE_DAYS_AHEAD - 1);
  });
});
