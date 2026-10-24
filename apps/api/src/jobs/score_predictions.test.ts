import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { ScorePredictionsJob, score_game, to_crowd_split } from "./score_predictions";
import type {
  CrowdRow,
  GoalRow,
  ScorableGame,
  ScorePredictionsRepository,
  ScoreUpdate,
  UnscoredPrediction,
} from "./score_predictions_repository";

const NOW = new Date("2026-10-24T20:00:00.000Z");
const HOME = "karpat";
const AWAY = "ilves";

// Kärpät beat Ilves 3–1; Laine scores twice.
const GAME: ScorableGame = {
  id: "game-1",
  sport: "hockey",
  home_team_id: HOME,
  away_team_id: AWAY,
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
  top_scorer_id: null,
};
const GOALS: GoalRow[] = [
  { game_id: GAME.id, team_id: HOME, player_id: "laine", period: 1 },
  { game_id: GAME.id, team_id: AWAY, player_id: "makela", period: 2 },
  { game_id: GAME.id, team_id: HOME, player_id: "niemi", period: 2 },
  { game_id: GAME.id, team_id: HOME, player_id: "laine", period: 3 },
];
// Only 5 of 25 fans (20%) picked Kärpät: a right Kärpät pick is a bold call.
const CROWD: CrowdRow[] = [
  { game_id: GAME.id, winner_team_id: HOME, pick_count: 5 },
  { game_id: GAME.id, winner_team_id: AWAY, pick_count: 20 },
];

function prediction(id: string, change: Partial<UnscoredPrediction>): UnscoredPrediction {
  return {
    id,
    game_id: GAME.id,
    winner_team_id: HOME,
    home_goals: 3,
    away_goals: 2,
    scorer_id: "laine",
    margin_band: null,
    ...change,
  };
}

class FakeRepository implements ScorePredictionsRepository {
  saved: { updates: readonly ScoreUpdate[]; scored_at: Date }[] = [];

  constructor(
    private readonly games: ScorableGame[],
    private readonly predictions: UnscoredPrediction[],
  ) {}

  find_games_to_score(): Promise<ScorableGame[]> {
    return Promise.resolve(this.games);
  }

  list_goals(): Promise<GoalRow[]> {
    return Promise.resolve(GOALS);
  }

  list_crowd(): Promise<CrowdRow[]> {
    return Promise.resolve(CROWD);
  }

  list_unscored_predictions(): Promise<UnscoredPrediction[]> {
    return Promise.resolve(this.predictions);
  }

  save_points(updates: readonly ScoreUpdate[], scored_at: Date): Promise<void> {
    this.saved.push({ updates, scored_at });
    return Promise.resolve();
  }
}

describe("score_game", () => {
  it("scores each pick, with a +5 bold call when fewer than 30% of the fans picked the winner", () => {
    const result = {
      home_team_id: HOME,
      away_team_id: AWAY,
      home_goals: 3,
      away_goals: 1,
      ended_in: "regulation" as const,
      goals: GOALS,
    };

    const updates = score_game("hockey", result, to_crowd_split(GAME.id, CROWD), [
      prediction("perfect", { away_goals: 1 }),
      prediction("winner_scorer", {}),
      prediction("wrong", { winner_team_id: AWAY, scorer_id: null }),
    ]);

    expect(updates).toEqual([
      { prediction_id: "perfect", points_awarded: 55 },
      { prediction_id: "winner_scorer", points_awarded: 30 },
      { prediction_id: "wrong", points_awarded: 0 },
    ]);
  });
});

describe("to_crowd_split", () => {
  it("counts the game's picks per team", () => {
    expect(to_crowd_split(GAME.id, CROWD)).toEqual({
      total_picks: 25,
      picks_by_team: { [HOME]: 5, [AWAY]: 20 },
    });
  });
});

describe("ScorePredictionsJob", () => {
  it("saves the points of all unscored picks with the scoring time", async () => {
    const repository = new FakeRepository([GAME], [prediction("p1", {})]);

    const result = await new ScorePredictionsJob(
      repository,
      pino({ level: "silent" }),
      () => NOW,
    ).run();

    expect(result).toEqual({ scored_game_count: 1, scored_prediction_count: 1 });
    expect(repository.saved).toEqual([
      { updates: [{ prediction_id: "p1", points_awarded: 30 }], scored_at: NOW },
    ]);
  });

  it("does nothing when no final game has unscored picks", async () => {
    const repository = new FakeRepository([], []);

    const result = await new ScorePredictionsJob(
      repository,
      pino({ level: "silent" }),
      () => NOW,
    ).run();

    expect(result).toEqual({ scored_game_count: 0, scored_prediction_count: 0 });
    expect(repository.saved).toEqual([]);
  });
});

describe("score_game per sport", () => {
  it("scores a football draw pick (null winner) and counts draws in the crowd", () => {
    const draw = {
      home_team_id: HOME,
      away_team_id: AWAY,
      home_goals: 1,
      away_goals: 1,
      ended_in: "regulation" as const,
      goals: [
        { team_id: HOME, player_id: "ali", period: 1 },
        { team_id: AWAY, player_id: "berg", period: 2 },
      ],
    };
    const crowd = to_crowd_split(GAME.id, [
      { game_id: GAME.id, winner_team_id: HOME, pick_count: 15 },
      { game_id: GAME.id, winner_team_id: null, pick_count: 5 },
    ]);
    expect(crowd.picks_by_team).toEqual({ [HOME]: 15, draw: 5 });

    const updates = score_game("football", draw, crowd, [
      prediction("draw_exact", {
        winner_team_id: null,
        home_goals: 1,
        away_goals: 1,
        scorer_id: "berg",
      }),
      prediction("home", { winner_team_id: HOME, home_goals: 2, away_goals: 1, scorer_id: null }),
    ]);
    // 10 + 25 + 15 + bold call (5 of 20 fans = 25% picked the draw).
    expect(updates).toEqual([
      { prediction_id: "draw_exact", points_awarded: 55 },
      { prediction_id: "home", points_awarded: 0 },
    ]);
  });

  it("scores basketball winner, margin band and top scorer", () => {
    const result = {
      home_team_id: HOME,
      away_team_id: AWAY,
      home_goals: 88,
      away_goals: 81,
      ended_in: "regulation" as const,
      goals: [],
      top_scorer_id: "koivu",
    };
    const updates = score_game("basketball", result, to_crowd_split(GAME.id, []), [
      prediction("all", {
        home_goals: null,
        away_goals: null,
        scorer_id: "koivu",
        margin_band: "6_10",
      }),
      prediction("winner", {
        home_goals: null,
        away_goals: null,
        scorer_id: null,
        margin_band: "1_5",
      }),
    ]);
    expect(updates).toEqual([
      { prediction_id: "all", points_awarded: 40 },
      { prediction_id: "winner", points_awarded: 10 },
    ]);
  });
});
