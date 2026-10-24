import type { Leaderboard, LeaderboardPeriod, SportFilter } from "@voita_kone/shared_types";
import { SPORT_IDS } from "@voita_kone/scoring";
import type { Clock } from "../../common/clock";
import { to_game_result } from "../../jobs/score_predictions";
import { build_leaderboard, type LeaderboardGame } from "./leaderboard_builder";
import type { LeaderboardRepository } from "./leaderboard_repository";

/** Sponsor prize slot. Prizes go by points (skill); no sponsor is signed yet (open question). */
export const PRIZE: Leaderboard["prize"] = {
  title: "Top 3: [Sponsor] gift card [€ value]",
  note: "Winners by points. Checked by the sports desk before prizes.",
};

export class LeaderboardService {
  constructor(
    private readonly repository: LeaderboardRepository,
    private readonly clock: Clock,
  ) {}

  /** Fans only, from the current season of every sport (`all`) or of one sport. */
  async get_leaderboard(
    period: LeaderboardPeriod,
    sport: SportFilter,
    me_user_id: string | null,
  ): Promise<Leaderboard> {
    const sports = sport === "all" ? SPORT_IDS : [sport];
    const seasons = await this.repository.find_current_seasons(sports);
    const rows = await this.repository.list_final_games(seasons);
    const game_ids = rows.map((row) => row.id);
    const [goals, picks, answers] = await Promise.all([
      this.repository.list_goals(game_ids),
      this.repository.list_scored_picks(game_ids),
      this.repository.list_answer_points(game_ids),
    ]);
    const games: LeaderboardGame[] = rows.map((row) => ({
      id: row.id,
      start_time: row.start_time,
      result: to_game_result(row, goals),
    }));
    return build_leaderboard({
      period,
      sport,
      now: this.clock(),
      games,
      picks,
      answers,
      me_user_id,
      prize: PRIZE,
    });
  }
}
