import type { DataSays, ReplayMoment, WinChance } from "@voita_kone/shared_types";
import type { Clock } from "../../common/clock";
import type { DemoReplayService } from "../demo/demo_replay_service";
import {
  to_data_says,
  to_crowd,
  to_live_model,
  to_stored_prediction,
  to_win_chance,
} from "./ai_predictions_mapper";
import type { AiPredictionsRepository, StoredPredictionRow } from "./ai_predictions_repository";
import { game_not_started, prediction_not_ready } from "./ai_predictions_service";
import { predict_from_season, to_season_data, type SeasonData } from "./model_inputs";
import type { ModelInputsRepository } from "./model_inputs_repository";

/** The replay day has several games; they share one season load for this long. */
const SEASON_CACHE_MS = 10 * 60 * 1000;

/**
 * The AI for the demo replay, with the same model as the real games: the pre-game pick of
 * the replayed real game is calculated from the data before its puck drop only. Results are
 * kept in memory (same input, same seed, same answer).
 */
export class DemoAiService {
  private readonly cache = new Map<string, Promise<StoredPredictionRow>>();
  private readonly seasons = new Map<string, { loaded_at: number; data: Promise<SeasonData> }>();

  constructor(
    private readonly demo_replay_service: DemoReplayService,
    private readonly inputs_repository: ModelInputsRepository,
    private readonly repository: AiPredictionsRepository,
    private readonly clock: Clock,
  ) {}

  async get_data_says(game_id: string, moment: ReplayMoment): Promise<DataSays> {
    const game = await this.demo_replay_service.get_game_detail(game_id, moment);
    const row = await this.pre_game_prediction(game_id);
    const crowd = await this.repository.count_crowd_picks(game_id, game.home_team.id);
    return to_data_says(row, to_crowd(crowd));
  }

  async get_win_chance(game_id: string, moment: ReplayMoment): Promise<WinChance> {
    const game = await this.demo_replay_service.get_game_detail(game_id, moment);
    if (game.state === "upcoming") {
      throw game_not_started(game_id);
    }
    const row = await this.pre_game_prediction(game_id);
    return to_win_chance(game, to_live_model(row), row.model_version, this.clock());
  }

  private pre_game_prediction(game_id: string): Promise<StoredPredictionRow> {
    let prediction = this.cache.get(game_id);
    if (!prediction) {
      prediction = this.calculate(game_id);
      // A failed calculation is not kept, so the next request tries again.
      prediction.catch(() => this.cache.delete(game_id));
      this.cache.set(game_id, prediction);
    }
    return prediction;
  }

  private async calculate(game_id: string): Promise<StoredPredictionRow> {
    const season = await this.find_season(game_id);
    const data = await this.load_season(season);
    const game = data.games.find((candidate) => candidate.id === game_id);
    if (!game) {
      throw prediction_not_ready(game_id);
    }
    return to_stored_prediction(predict_from_season(data, game), data.players, this.clock());
  }

  private load_season(season: string): Promise<SeasonData> {
    const now = this.clock().getTime();
    const cached = this.seasons.get(season);
    if (cached && now - cached.loaded_at < SEASON_CACHE_MS) {
      return cached.data;
    }
    const data = this.inputs_repository.load_season(season).then(to_season_data);
    data.catch(() => this.seasons.delete(season));
    this.seasons.set(season, { loaded_at: now, data });
    return data;
  }

  private async find_season(game_id: string): Promise<string> {
    const season = await this.inputs_repository.find_game_season(game_id);
    if (!season) {
      throw prediction_not_ready(game_id);
    }
    return season;
  }
}
