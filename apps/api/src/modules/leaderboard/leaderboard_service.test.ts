import { describe, expect, it } from "vitest";
import type { AiPickRow, GoalRow } from "../../jobs/score_predictions_repository";
import type { LeaderboardAnswerPoints, LeaderboardPick } from "./leaderboard_builder";
import type { LeaderboardRepository, SeasonGameRow } from "./leaderboard_repository";
import { LeaderboardService, PRIZE } from "./leaderboard_service";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const GAME: SeasonGameRow = {
  id: "game",
  start_time: new Date("2026-10-23T16:30:00.000Z"),
  home_team_id: "home",
  away_team_id: "away",
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
};

class FakeLeaderboardRepository implements LeaderboardRepository {
  season_asked: string | undefined;
  answer_points: LeaderboardAnswerPoints[] = [];

  find_current_season(): Promise<string | undefined> {
    return Promise.resolve("2026-27");
  }

  list_final_games(season: string): Promise<SeasonGameRow[]> {
    this.season_asked = season;
    return Promise.resolve([GAME]);
  }

  list_goals(): Promise<GoalRow[]> {
    const goal = (team_id: string, player_id: string, period: number): GoalRow => ({
      game_id: GAME.id,
      team_id,
      player_id,
      period,
    });
    return Promise.resolve([
      goal("home", "laine", 1),
      goal("away", "makela", 2),
      goal("home", "niemi", 2),
      goal("home", "laine", 3),
    ]);
  }

  list_ai_picks(): Promise<AiPickRow[]> {
    return Promise.resolve([
      {
        game_id: GAME.id,
        winner_team_id: "home",
        home_goals: 3,
        away_goals: 1,
        scorer_id: "laine",
      },
    ]);
  }

  list_scored_picks(): Promise<LeaderboardPick[]> {
    return Promise.resolve([
      {
        user_id: "u1",
        display_name: "Mika",
        game_id: GAME.id,
        winner_team_id: "home",
        points_awarded: 10,
      },
    ]);
  }

  list_answer_points(): Promise<LeaderboardAnswerPoints[]> {
    return Promise.resolve(this.answer_points);
  }
}

describe("LeaderboardService", () => {
  it("builds the current season's leaderboard with the AI's points from its own pick", async () => {
    const repository = new FakeLeaderboardRepository();

    const board = await new LeaderboardService(repository, () => NOW).get_leaderboard("week", "u1");

    expect(repository.season_asked).toBe("2026-27");
    expect(board.prize).toEqual(PRIZE);
    // The AI got winner + exact score + scorer right: 50 points.
    expect(board.rows.map((row) => [row.kind, row.points])).toEqual([
      ["ai", 50],
      ["you", 10],
    ]);
  });

  it("adds live pick, quiz and vote points, also for fans without a winner pick", async () => {
    const repository = new FakeLeaderboardRepository();
    repository.answer_points = [
      { user_id: "u1", display_name: "Mika", game_id: GAME.id, points_awarded: 8 },
      { user_id: "u2", display_name: "Sanna", game_id: GAME.id, points_awarded: 5 },
    ];

    const board = await new LeaderboardService(repository, () => NOW).get_leaderboard("week", "u1");

    expect(board.rows.map((row) => [row.kind, row.display_name, row.points])).toEqual([
      ["ai", "Kaleva AI", 50],
      ["you", "Mika", 18],
      ["user", "Sanna", 5],
    ]);
    // Answers don't change winner accuracy: only Mika picked a winner.
    expect(board.accuracy.fans).toBe(1);
  });
});
