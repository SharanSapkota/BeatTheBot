import { backtest, type BacktestResult, type PlayedGame } from "@voita_kone/prediction_model";
import type { LiigaClient } from "../integrations/liiga_client/liiga_client";
import {
  map_game,
  to_season_label,
  type SyncGame,
} from "../integrations/liiga_client/liiga_mapper";

export interface SeasonBacktest {
  season: string;
  team_count: number;
  result: BacktestResult;
}

/** Finished Liiga games as model input; team ids are the Liiga team ids. */
export function to_played_games(games: readonly SyncGame[]): PlayedGame[] {
  return games.flatMap((game) =>
    game.status === "final" && game.home_goals !== null && game.away_goals !== null && game.ended_in
      ? [
          {
            id: game.external_id,
            start_time: game.start_time,
            home_team_id: game.home_team_external_id,
            away_team_id: game.away_team_external_id,
            home_goals: game.home_goals,
            away_goals: game.away_goals,
            ended_in: game.ended_in,
          },
        ]
      : [],
  );
}

/** Walk-forward back-test of one season, straight from the Liiga API (nothing is stored). */
export async function backtest_season(
  liiga_client: LiigaClient,
  liiga_season: number,
): Promise<SeasonBacktest> {
  const games = (await liiga_client.get_games(liiga_season))
    .map(map_game)
    .filter((game): game is SyncGame => game !== null);
  const played = to_played_games(games);
  const team_ids = [...new Set(played.flatMap((game) => [game.home_team_id, game.away_team_id]))];
  return {
    season: to_season_label(liiga_season),
    team_count: team_ids.length,
    result: backtest(team_ids, played),
  };
}
