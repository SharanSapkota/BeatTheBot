import { describe, expect, it } from "vitest";
import {
  build_demo_fill,
  to_game_time_seconds,
  type FillInput,
  type FillTeam,
  type HubState,
} from "./demo_fill";

const NOW = new Date("2026-10-24T09:02:00Z");

function team(id: string, name: string, forward_count = 3): FillTeam {
  return {
    id,
    name,
    forward_ids: Array.from({ length: forward_count }, (_, index) => `${id}_f${String(index)}`),
  };
}

const TEAMS = [
  team("ilves", "Ilves"),
  team("hpk", "HPK"),
  team("karpat", "Kärpät"),
  team("tappara", "Tappara"),
  team("lukko", "Lukko"),
  team("tps", "TPS"),
];

function fill_input(overrides: Partial<FillInput> = {}): FillInput {
  return {
    now: NOW,
    season: "2026-27",
    teams: TEAMS,
    todays_states: new Set<HubState>(),
    busy_team_ids: new Set<string>(),
    ...overrides,
  };
}

describe("to_game_time_seconds", () => {
  it("counts seconds from the start of the game", () => {
    expect(to_game_time_seconds(1, "14:37")).toBe(877);
    expect(to_game_time_seconds(2, "05:12")).toBe(1512);
  });
});

describe("build_demo_fill", () => {
  it("creates one game per missing state, Kärpät first", () => {
    const fill = build_demo_fill(fill_input());

    expect(fill.games.map((game) => [game.external_id, game.status])).toEqual([
      ["demo_final", "final"],
      ["demo_live", "live"],
      ["demo_upcoming", "scheduled"],
    ]);
    expect(fill.games[0]).toMatchObject({ home_team_id: "karpat", away_team_id: "hpk" });
    expect(fill.unfilled_states).toEqual([]);
  });

  it("only fills states that have no real game today", () => {
    const fill = build_demo_fill(fill_input({ todays_states: new Set(["upcoming", "final"]) }));

    expect(fill.games.map((game) => game.external_id)).toEqual(["demo_live"]);
  });

  it("skips teams that already play today", () => {
    const fill = build_demo_fill(
      fill_input({
        busy_team_ids: new Set(["karpat"]),
        todays_states: new Set(["live", "upcoming"]),
      }),
    );

    expect(fill.games[0]).toMatchObject({ home_team_id: "hpk", away_team_id: "ilves" });
  });

  it("gives the final a 3-1 result whose goal events match the score", () => {
    const fill = build_demo_fill(fill_input());
    const final = fill.games.find((game) => game.status === "final");
    const final_events = fill.events.filter((event) => event.game_external_id === "demo_final");

    expect(final).toMatchObject({ home_goals: 3, away_goals: 1, ended_in: "regulation" });
    expect(final_events).toHaveLength(4);
    expect(final_events[0]).toMatchObject({
      team_id: "karpat",
      player_id: "karpat_f0",
      assist_player_ids: ["karpat_f1"],
      game_time_seconds: 877,
    });
  });

  it("gives the live game a current score and the upcoming game none", () => {
    const fill = build_demo_fill(fill_input());
    const live = fill.games.find((game) => game.status === "live");
    const upcoming = fill.games.find((game) => game.status === "scheduled");

    expect(live).toMatchObject({ home_goals: 1, away_goals: 1, ended_in: null });
    expect(upcoming).toMatchObject({ home_goals: null, away_goals: null, ended_in: null });
  });

  it("places start times around now, rounded to 5 minutes", () => {
    const fill = build_demo_fill(fill_input());
    const start_of = (status: string) =>
      fill.games.find((game) => game.status === status)?.start_time.toISOString();

    expect(start_of("final")).toBe("2026-10-24T06:00:00.000Z");
    expect(start_of("live")).toBe("2026-10-24T08:00:00.000Z");
    expect(start_of("scheduled")).toBe("2026-10-24T11:00:00.000Z");
  });

  it("reports states it cannot fill and ignores teams without two forwards", () => {
    const fill = build_demo_fill(
      fill_input({ teams: [team("karpat", "Kärpät"), team("hpk", "HPK"), team("x", "X", 1)] }),
    );

    expect(fill.games).toHaveLength(1);
    expect(fill.unfilled_states).toEqual(["live", "upcoming"]);
  });
});
