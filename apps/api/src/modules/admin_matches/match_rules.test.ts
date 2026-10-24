import type { AdminMatchResultInput } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import {
  final_period,
  half_of,
  minute_to_seconds,
  result_rule_error,
  season_of,
} from "./match_rules";

const HOME = "6a6a2f0e-0d1c-4a52-9b2b-2a5e1f0c0001";
const AWAY = "6a6a2f0e-0d1c-4a52-9b2b-2a5e1f0c0002";
const HOME_PLAYER = "6a6a2f0e-0d1c-4a52-9b2b-2a5e1f0c0011";
const AWAY_PLAYER = "6a6a2f0e-0d1c-4a52-9b2b-2a5e1f0c0012";
const MATCH = { home_team_id: HOME, away_team_id: AWAY };
const PLAYERS = new Map([
  [HOME_PLAYER, HOME],
  [AWAY_PLAYER, AWAY],
]);

function result(change: Partial<AdminMatchResultInput>): AdminMatchResultInput {
  return {
    home_goals: 1,
    away_goals: 0,
    ended_in: "regulation",
    goals: [],
    top_scorer_player_id: null,
    ...change,
  };
}

describe("season_of", () => {
  it("is the calendar year for football and autumn–spring for basketball", () => {
    expect(season_of("football", new Date("2026-10-24T12:00:00Z"))).toBe("2026");
    expect(season_of("basketball", new Date("2026-10-24T12:00:00Z"))).toBe("2026-27");
    expect(season_of("basketball", new Date("2027-03-01T12:00:00Z"))).toBe("2026-27");
  });
});

describe("football minutes", () => {
  it("maps minutes to halves and seconds", () => {
    expect([half_of(1), half_of(45), half_of(46), half_of(94)]).toEqual([1, 1, 2, 2]);
    expect(minute_to_seconds(62)).toBe(3661);
    expect(final_period("football", "regulation")).toBe(2);
    expect(final_period("basketball", "overtime")).toBe(5);
  });
});

describe("result_rule_error", () => {
  const goal = (team_id: string, player_id: string | null, minute = 10) => ({
    team_id,
    player_id,
    minute,
  });
  // [label, sport, result change, error or null]
  const cases: [
    string,
    "football" | "basketball",
    Partial<AdminMatchResultInput>,
    string | null,
  ][] = [
    ["football draw without scorers", "football", { home_goals: 0, away_goals: 0 }, null],
    [
      "football 2–1 with all goals",
      "football",
      {
        home_goals: 2,
        away_goals: 1,
        goals: [goal(HOME, HOME_PLAYER), goal(AWAY, null), goal(HOME, null, 80)],
      },
      null,
    ],
    [
      "football goals don't add up",
      "football",
      { home_goals: 2, away_goals: 1, goals: [goal(HOME, HOME_PLAYER)] },
      "The goals must add up to the final score (or leave the scorers empty)",
    ],
    [
      "football scorer of the other team",
      "football",
      { goals: [goal(HOME, AWAY_PLAYER)] },
      "A scorer must play for the team that scored",
    ],
    [
      "football overtime",
      "football",
      { ended_in: "overtime" },
      "A league football match has no overtime",
    ],
    [
      "football top scorer",
      "football",
      { top_scorer_player_id: HOME_PLAYER },
      "Football has no top scorer; list the goals instead",
    ],
    [
      "basketball with a top scorer",
      "basketball",
      { home_goals: 88, away_goals: 80, top_scorer_player_id: AWAY_PLAYER },
      null,
    ],
    [
      "basketball draw",
      "basketball",
      { home_goals: 80, away_goals: 80 },
      "A basketball match can't end in a draw",
    ],
    [
      "basketball goals",
      "basketball",
      { home_goals: 88, away_goals: 80, goals: [goal(HOME, null)] },
      "Basketball has no goal list; enter the top scorer instead",
    ],
    [
      "basketball unknown top scorer",
      "basketball",
      {
        home_goals: 88,
        away_goals: 80,
        top_scorer_player_id: "6a6a2f0e-0d1c-4a52-9b2b-2a5e1f0c0099",
      },
      "The top scorer must play for one of the two teams",
    ],
  ];

  it.each(cases)("%s", (_label, sport, change, error) => {
    expect(result_rule_error(sport, MATCH, result(change), PLAYERS)).toBe(error);
  });
});
