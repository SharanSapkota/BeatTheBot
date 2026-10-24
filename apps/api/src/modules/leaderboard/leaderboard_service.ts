import type { Leaderboard, LeaderboardPeriod } from "@voita_kone/shared_types";
import { season_config } from "@voita_kone/prediction_model";
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

  async get_leaderboard(
    period: LeaderboardPeriod,
    me_user_id: string | null,
  ): Promise<Leaderboard> {
    const season = (await this.repository.find_current_season()) ?? season_config.season;
    const rows = await this.repository.list_final_games(season);
    const game_ids = rows.map((row) => row.id);
    const [goals, ai_picks, picks, answers] = await Promise.all([
      this.repository.list_goals(game_ids),
      this.repository.list_ai_picks(game_ids),
      this.repository.list_scored_picks(game_ids),
      this.repository.list_answer_points(game_ids),
    ]);
    const games: LeaderboardGame[] = rows.map((row) => {
      const ai_pick = ai_picks.find((pick) => pick.game_id === row.id);
      return {
        id: row.id,
        start_time: row.start_time,
        result: to_game_result(row, goals),
        ai_pick: ai_pick
          ? {
              winner_team_id: ai_pick.winner_team_id,
              home_goals: ai_pick.home_goals,
              away_goals: ai_pick.away_goals,
              scorer_id: ai_pick.scorer_id,
            }
          : null,
      };
    });
    return build_leaderboard({
      period,
      now: this.clock(),
      games,
      picks,
      answers,
      me_user_id,
      prize: PRIZE,
    });
  }
}
