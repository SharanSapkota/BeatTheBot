import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { ScorePredictionsJob, score_game } from "./score_predictions";
import type {
  AiPickRow,
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
  home_team_id: HOME,
  away_team_id: AWAY,
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
};
const GOALS: GoalRow[] = [
  { game_id: GAME.id, team_id: HOME, player_id: "laine", period: 1 },
  { game_id: GAME.id, team_id: AWAY, player_id: "makela", period: 2 },
  { game_id: GAME.id, team_id: HOME, player_id: "niemi", period: 2 },
  { game_id: GAME.id, team_id: HOME, player_id: "laine", period: 3 },
];
const AI_WRONG: AiPickRow = {
  game_id: GAME.id,
  winner_team_id: AWAY,
  home_goals: 2,
  away_goals: 3,
  scorer_id: "makela",
};

function prediction(id: string, change: Partial<UnscoredPrediction>): UnscoredPrediction {
  return {
    id,
    game_id: GAME.id,
    winner_team_id: HOME,
    home_goals: 3,
    away_goals: 2,
    scorer_id: "laine",
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

  list_ai_picks(): Promise<AiPickRow[]> {
    return Promise.resolve([AI_WRONG]);
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
  it("scores each pick, with +5 when the AI picked the wrong winner", () => {
    const result = {
      home_team_id: HOME,
      away_team_id: AWAY,
      home_goals: 3,
      away_goals: 1,
      ended_in: "regulation" as const,
      goals: GOALS,
    };

    const updates = score_game(result, AI_WRONG, [
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
