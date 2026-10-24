import type { Database } from "../../db/kysely";

export interface PickableGameRow {
  id: string;
  sport: string;
  start_time: Date;
  home_team_id: string;
  away_team_id: string;
}

export interface PredictionValues {
  /** Null = a draw (football only). */
  predicted_winner_team_id: string | null;
  /** Null in basketball (no exact score). */
  predicted_home_goals: number | null;
  predicted_away_goals: number | null;
  predicted_scorer_id: string | null;
  predicted_margin_band: string | null;
}

export interface PredictionRow extends PredictionValues {
  game_id: string;
  points_awarded: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface PredictionsRepository {
  find_game(game_id: string): Promise<PickableGameRow | undefined>;
  /** The player's team, or undefined for an unknown player. */
  find_player_team_id(player_id: string): Promise<string | null | undefined>;
  find_prediction(user_id: string, game_id: string): Promise<PredictionRow | undefined>;
  /** Undefined when the user already has a pick for this game (unique user + game). */
  insert_prediction(
    user_id: string,
    game_id: string,
    values: PredictionValues,
  ): Promise<PredictionRow | undefined>;
  update_prediction(
    user_id: string,
    game_id: string,
    values: PredictionValues,
  ): Promise<PredictionRow | undefined>;
  /** The user's picks, newest game first; one game only when game_id is given. */
  list_predictions(user_id: string, game_id: string | undefined): Promise<PredictionRow[]>;
}

const PREDICTION_COLUMNS = [
  "user_predictions.game_id",
  "user_predictions.predicted_winner_team_id",
  "user_predictions.predicted_home_goals",
  "user_predictions.predicted_away_goals",
  "user_predictions.predicted_scorer_id",
  "user_predictions.predicted_margin_band",
  "user_predictions.points_awarded",
  "user_predictions.created_at",
  "user_predictions.updated_at",
] as const;

export class KyselyPredictionsRepository implements PredictionsRepository {
  constructor(private readonly db: Database) {}

  find_game(game_id: string): Promise<PickableGameRow | undefined> {
    return this.db
      .selectFrom("games")
      .select(["id", "sport", "start_time", "home_team_id", "away_team_id"])
      .where("id", "=", game_id)
      .executeTakeFirst();
  }

  async find_player_team_id(player_id: string): Promise<string | null | undefined> {
    const player = await this.db
      .selectFrom("players")
      .select("team_id")
      .where("id", "=", player_id)
      .executeTakeFirst();
    return player?.team_id;
  }

  find_prediction(user_id: string, game_id: string): Promise<PredictionRow | undefined> {
    return this.db
      .selectFrom("user_predictions")
      .select(PREDICTION_COLUMNS)
      .where("user_id", "=", user_id)
      .where("game_id", "=", game_id)
      .executeTakeFirst();
  }

  insert_prediction(
    user_id: string,
    game_id: string,
    values: PredictionValues,
  ): Promise<PredictionRow | undefined> {
    return this.db
      .insertInto("user_predictions")
      .values({ user_id, game_id, ...values })
      .onConflict((conflict) =>
        conflict.constraint("user_predictions_user_id_game_id_unique").doNothing(),
      )
      .returning(PREDICTION_COLUMNS)
      .executeTakeFirst();
  }

  update_prediction(
    user_id: string,
    game_id: string,
    values: PredictionValues,
  ): Promise<PredictionRow | undefined> {
    return this.db
      .updateTable("user_predictions")
      .set(values)
      .where("user_id", "=", user_id)
      .where("game_id", "=", game_id)
      .returning(PREDICTION_COLUMNS)
      .executeTakeFirst();
  }

  list_predictions(user_id: string, game_id: string | undefined): Promise<PredictionRow[]> {
    let query = this.db
      .selectFrom("user_predictions")
      .innerJoin("games", "games.id", "user_predictions.game_id")
      .select(PREDICTION_COLUMNS)
      .where("user_predictions.user_id", "=", user_id);
    if (game_id !== undefined) {
      query = query.where("user_predictions.game_id", "=", game_id);
    }
    return query.orderBy("games.start_time", "desc").execute();
  }
}
