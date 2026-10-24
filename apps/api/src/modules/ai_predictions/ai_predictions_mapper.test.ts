import { ai_prediction_schema, win_chance_schema } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { to_game_summary } from "../games/games_mapper";
import { AWAY_TEAM, HOME_TEAM, build_game_row } from "../../test_helpers/game_rows";
import { AI_PICK_LABEL, to_ai_prediction, to_crowd, to_win_chance } from "./ai_predictions_mapper";
import type { StoredPredictionRow } from "./ai_predictions_repository";

const GAME_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCORER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const STORED: StoredPredictionRow = {
  game_id: GAME_ID,
  predicted_winner_team_id: HOME_TEAM.id,
  home_win_probability: 0.62,
  away_win_probability: 0.38,
  overtime_probability: 0.17,
  predicted_home_goals: 3,
  predicted_away_goals: 2,
  expected_home_goals: 3.2,
  expected_away_goals: 2.5,
  overtime_home_share: 0.52,
  reasons: [
    {
      fact_id: "venue_record:home:x",
      type: "venue_record",
      team_id: HOME_TEAM.id,
      values: { team: "Kärpät", wins: 4, games: 5 },
      text_en: "Kärpät won 4 of their last 5 home games.",
      relevance: 0.3,
      favours_team_id: HOME_TEAM.id,
    },
  ],
  stakes: {
    highlights: [{ team_id: HOME_TEAM.id, kind: "relegation", if_win: 0.27, if_loss: 0.4 }],
    all: [],
  },
  scorer_form: { recent_goals: 4, recent_games: 5, season_goals: 9 },
  scorer: {
    id: SCORER_ID,
    team_id: HOME_TEAM.id,
    first_name: "Eetu",
    last_name: "Laine",
    jersey_number: 19,
  },
  model_version: "poisson_mc_v1",
  calculated_at: new Date("2026-10-24T13:05:00Z"),
};

describe("to_crowd", () => {
  it("is null without picks and a share with picks", () => {
    expect(to_crowd({ home_picks: 0, total_picks: 0 })).toBeNull();
    expect(to_crowd({ home_picks: 3, total_picks: 4 })).toEqual({
      home_pick_share: 0.75,
      total_picks: 4,
    });
  });
});

describe("to_ai_prediction", () => {
  it("returns the API shape with only the public reason fields", () => {
    const prediction = ai_prediction_schema.parse(to_ai_prediction(STORED, null));

    expect(prediction.reasons).toEqual([
      {
        fact_id: "venue_record:home:x",
        type: "venue_record",
        values: { team: "Kärpät", wins: 4, games: 5 },
        text_en: "Kärpät won 4 of their last 5 home games.",
      },
    ]);
    expect(prediction.predicted_scorer).toMatchObject({ id: SCORER_ID, recent_goals: 4 });
    expect(prediction.stakes).toHaveLength(1);
    expect(prediction.label_text).toBe(AI_PICK_LABEL);
    expect(prediction.calculated_at).toBe("2026-10-24T13:05:00.000Z");
  });
});

describe("to_win_chance", () => {
  const live_model = { expected_goals: { home: 3.2, away: 2.5 }, overtime_home_share: 0.52 };
  const goal = (id: string, team_id: string, game_time_seconds: number, period = 1) => ({
    id,
    event_type: "goal" as const,
    period,
    game_time_seconds,
    team_id,
    player: null,
    assists: [],
    penalty_minutes: null,
    score_after: null,
  });

  it("ends with now while live", () => {
    const summary = to_game_summary(
      build_game_row({ status: "live", home_goals: 1, away_goals: 0, game_clock_seconds: 1500 }),
      HOME_TEAM.external_id,
    );
    const chance = win_chance_schema.parse(
      to_win_chance(
        { ...summary, events: [goal("e1", HOME_TEAM.id, 600)], demo_replay: false },
        live_model,
        "v1",
        new Date("2026-10-24T16:00:00Z"),
      ),
    );

    expect(chance.points.map((point) => point.kind)).toEqual(["start", "goal", "now"]);
    expect(chance.points.at(-1)?.game_time_seconds).toBe(1500);
  });

  it("ends at the result for a final game and ignores shootout attempts", () => {
    const summary = to_game_summary(
      build_game_row({ status: "final", home_goals: 1, away_goals: 2, ended_in: "shootout" }),
      HOME_TEAM.external_id,
    );
    const chance = to_win_chance(
      {
        ...summary,
        events: [
          goal("e1", HOME_TEAM.id, 600),
          goal("e2", AWAY_TEAM.id, 3000, 3),
          goal("e3", AWAY_TEAM.id, 3900, 5),
        ],
        demo_replay: false,
      },
      live_model,
      "v1",
      new Date(),
    );

    expect(chance.points.map((point) => [point.kind, point.home_win_probability])).toEqual([
      ["start", expect.any(Number)],
      ["goal", expect.any(Number)],
      ["goal", expect.any(Number)],
      ["end", 0],
    ]);
  });
});
