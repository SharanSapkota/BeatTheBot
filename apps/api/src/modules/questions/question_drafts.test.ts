import type { GameDetail, GameEvent, PlayerSummary } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import {
  build_after_drafts,
  build_live_drafts,
  current_correct_option,
  is_question_locked,
  player_options,
} from "./question_drafts";

const NOW = new Date("2026-10-24T17:30:00.000Z");
const HOME = "00000000-0000-4000-8000-000000000001";
const AWAY = "00000000-0000-4000-8000-000000000002";

function team(id: string, name: string) {
  return {
    id,
    external_id: name,
    name,
    short_name: name,
    city: null,
    logo_url: null,
    sport: "hockey" as const,
    data_source: "liiga_api" as const,
  };
}

function goal(id: string, team_id: string, period: number, player_id: string): GameEvent {
  return {
    id,
    event_type: "goal",
    period,
    game_time_seconds: period * 1000,
    team_id,
    player: {
      id: player_id,
      first_name: "Player",
      last_name: player_id.slice(-1),
      jersey_number: null,
    },
    assists: [],
    penalty_minutes: null,
    score_after: null,
  };
}

function game(change: Partial<GameDetail>): GameDetail {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    sport: "hockey",
    league: { id: "00000000-0000-4000-8000-000000000001", name: "Liiga" },
    season: "2026-27",
    start_time: "2026-10-24T16:30:00.000Z",
    state: "live",
    period: 2,
    game_clock_seconds: 1500,
    home_team: team(HOME, "Kärpät"),
    away_team: team(AWAY, "KalPa"),
    home_goals: 1,
    away_goals: 0,
    ended_in: null,
    featured: true,
    data_source: "liiga_api",
    events: [goal("e1", HOME, 1, "00000000-0000-4000-8000-00000000000a")],
    demo_replay: false,
    top_scorer: null,
    ...change,
  };
}

function player(
  id: string,
  season_goals: number,
  position: PlayerSummary["position"] = "forward",
): PlayerSummary {
  return {
    id,
    first_name: "Season",
    last_name: id.slice(-1),
    jersey_number: null,
    position,
    birth_year: null,
    season_goals,
    goals_last_5: 0,
  };
}

const PLAYERS = [
  player("00000000-0000-4000-8000-00000000000b", 9),
  player("00000000-0000-4000-8000-00000000000c", 4),
  player("00000000-0000-4000-8000-00000000000d", 12, "goalie"),
  player("00000000-0000-4000-8000-00000000000e", 7),
];

describe("build_live_drafts", () => {
  it("opens the next-goal pick for the current goal count, the 3rd period pick and the poll", () => {
    const drafts = build_live_drafts(game({}), PLAYERS, NOW);
    expect(drafts.map((draft) => [draft.key, draft.points])).toEqual([
      ["next_goal:1", 5],
      ["period_goal:3", 3],
      ["poll", 0],
    ]);
    expect(drafts[0]?.locks_at).toEqual(new Date(NOW.getTime() + 2 * 60 * 1000));
  });

  it("has no live questions before or after the game", () => {
    expect(build_live_drafts(game({ state: "upcoming" }), PLAYERS, NOW)).toEqual([]);
    expect(build_live_drafts(game({ state: "final" }), PLAYERS, NOW)).toEqual([]);
  });
});

describe("questions per sport", () => {
  it("offers next goal and the poll in football, only the poll in basketball", () => {
    const types = (sport: "football" | "basketball") =>
      build_live_drafts(game({ sport }), PLAYERS, NOW).map((draft) => draft.question_type);

    expect(types("football")).toEqual(["next_goal", "poll"]);
    expect(types("basketball")).toEqual(["poll"]);
  });

  it("has no result quiz after a basketball game, only the player vote", () => {
    const drafts = build_after_drafts(
      game({ sport: "basketball", state: "final" }),
      PLAYERS,
      [],
      NOW,
    );

    expect(drafts.map((draft) => draft.question_type)).toEqual(["player_vote"]);
  });
});

describe("player_options", () => {
  it("lists the game's scorers first, then the best season scorers (no goalies)", () => {
    expect(player_options(game({}), PLAYERS).map((option) => option.id)).toEqual([
      "00000000-0000-4000-8000-00000000000a",
      "00000000-0000-4000-8000-00000000000b",
      "00000000-0000-4000-8000-00000000000e",
      "00000000-0000-4000-8000-00000000000c",
    ]);
  });
});

describe("build_after_drafts", () => {
  it("adds the quiz and the player vote only once the game is final", () => {
    expect(build_after_drafts(game({}), PLAYERS, [], NOW)).toEqual([]);
    const drafts = build_after_drafts(game({ state: "final" }), PLAYERS, [], NOW);
    expect(drafts.map((draft) => [draft.key, draft.points])).toEqual([["player_vote", 1]]);
  });
});

describe("locks and right answers", () => {
  const later = new Date(NOW.getTime() + 60 * 60 * 1000);
  const next_goal = {
    question_type: "next_goal" as const,
    target: 1,
    locks_at: later,
    correct_option: null,
  };
  const period_goal = {
    question_type: "period_goal" as const,
    target: 3,
    locks_at: later,
    correct_option: null,
  };

  it("locks the next-goal pick when the goal is scored or the time is up", () => {
    expect(is_question_locked(next_goal, game({}), NOW)).toBe(false);
    expect(is_question_locked(next_goal, game({}), later)).toBe(true);
    const scored = game({
      events: [...game({}).events, goal("e2", AWAY, 2, "00000000-0000-4000-8000-00000000000f")],
    });
    expect(is_question_locked(next_goal, scored, NOW)).toBe(true);
    expect(current_correct_option(next_goal, scored)).toBe("away");
  });

  it("locks the period pick when the period starts and decides it when it ends", () => {
    expect(is_question_locked(period_goal, game({ period: 3 }), NOW)).toBe(true);
    expect(current_correct_option(period_goal, game({ period: 3 }))).toBeNull();
    expect(current_correct_option(period_goal, game({ state: "final", period: 3 }))).toBe("no");
  });
});
