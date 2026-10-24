import { describe, expect, it } from "vitest";
import type { GoalRow } from "../../jobs/score_predictions_repository";
import type { LeaderboardAnswerPoints, LeaderboardPick } from "./leaderboard_builder";
import type { LeaderboardRepository, SeasonGameRow, SportSeason } from "./leaderboard_repository";
import { LeaderboardService, PRIZE } from "./leaderboard_service";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const GAME: SeasonGameRow = {
  id: "game",
  sport: "hockey",
  top_scorer_id: null,
  start_time: new Date("2026-10-23T16:30:00.000Z"),
  home_team_id: "home",
  away_team_id: "away",
  home_goals: 3,
  away_goals: 1,
  ended_in: "regulation",
};

class FakeLeaderboardRepository implements LeaderboardRepository {
  sports_asked: readonly string[] = [];
  seasons_asked: readonly SportSeason[] = [];
  answer_points: LeaderboardAnswerPoints[] = [];

  find_current_seasons(sports: readonly SportSeason["sport"][]): Promise<SportSeason[]> {
    this.sports_asked = sports;
    const seasons: SportSeason[] = [
      { sport: "hockey", season: "2026-27" },
      { sport: "football", season: "2026" },
    ];
    return Promise.resolve(seasons.filter((season) => sports.includes(season.sport)));
  }

  list_final_games(seasons: readonly SportSeason[]): Promise<SeasonGameRow[]> {
    this.seasons_asked = seasons;
    return Promise.resolve(seasons.some((season) => season.sport === "hockey") ? [GAME] : []);
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
  it("builds the current season's leaderboard from the fans' points only", async () => {
    const repository = new FakeLeaderboardRepository();

    const board = await new LeaderboardService(repository, () => NOW).get_leaderboard(
      "week",
      "all",
      "u1",
    );

    expect(repository.seasons_asked).toEqual([
      { sport: "hockey", season: "2026-27" },
      { sport: "football", season: "2026" },
    ]);
    expect(board.sport).toBe("all");
    expect(board.prize).toEqual(PRIZE);
    expect(board.rows.map((row) => [row.kind, row.points])).toEqual([["you", 10]]);
    expect(board.summary).toEqual({ you_accuracy: 1, fans_accuracy: 1, games_count: 1 });
  });

  it("adds live pick, quiz and vote points, also for fans without a winner pick", async () => {
    const repository = new FakeLeaderboardRepository();
    repository.answer_points = [
      { user_id: "u1", display_name: "Mika", game_id: GAME.id, points_awarded: 8 },
      { user_id: "u2", display_name: "Sanna", game_id: GAME.id, points_awarded: 5 },
    ];

    const board = await new LeaderboardService(repository, () => NOW).get_leaderboard(
      "week",
      "all",
      "u1",
    );

    expect(board.rows.map((row) => [row.kind, row.display_name, row.points])).toEqual([
      ["you", "Mika", 18],
      ["user", "Sanna", 5],
    ]);
    // Answers don't change winner accuracy: only Mika picked a winner.
    expect(board.summary.fans_accuracy).toBe(1);
  });

  it("filters one sport: its own current season only", async () => {
    const repository = new FakeLeaderboardRepository();

    const board = await new LeaderboardService(repository, () => NOW).get_leaderboard(
      "season",
      "football",
      null,
    );

    expect(repository.sports_asked).toEqual(["football"]);
    expect(repository.seasons_asked).toEqual([{ sport: "football", season: "2026" }]);
    expect(board.sport).toBe("football");
    expect(board.rows).toEqual([]);
  });
});
