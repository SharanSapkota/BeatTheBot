import {
  build_fact_sheet,
  build_preview_fact_sheet,
  MEETING_COUNT,
  type FactSheet,
} from "@voita_kone/fact_checker";
import { model_config, type GamePrediction } from "@voita_kone/prediction_model";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import type { LlmClient } from "../../integrations/llm_client/llm_client";
import { game_not_found } from "../games/games_service";
import {
  predict_from_season,
  to_season_data,
  type SeasonData,
} from "../ai_predictions/model_inputs";
import type { ModelInputsRepository } from "../ai_predictions/model_inputs_repository";
import { compute_season_facts, to_fact_sheet_input, type StoryGame } from "./fact_sheet_input";
import { to_preview_input } from "./preview_facts";
import type { StoriesRepository, StoryGameRow, StoryType } from "./stories_repository";
import { build_headline } from "./story_headline";
import { write_story } from "./story_writer";
import type { TrafficLight } from "./traffic_light";

export const STORY_LANGUAGE = "en";
/** Editorial rule 4: every AI text is labelled. */
export const AI_STORY_LABEL = "Written with AI from Liiga data · checked by Kaleva";
export const TEMPLATE_LABELS: Record<StoryType, string> = {
  preview: "Automatic preview from Liiga data",
  summary: "Automatic summary from Liiga data",
};
/** A loaded season is reused for this long (one job run writes many previews). */
const SEASON_CACHE_MS = 60 * 1000;

export interface GenerationResult {
  story_id: string;
  traffic_light: TrafficLight;
  source: "llm" | "template";
}

export interface GenerationOptions {
  /** Season simulations per odds estimate and per stake (fewer in tests). */
  season_simulations?: number;
  stakes_simulations?: number;
}

function game_not_final(game_id: string): AppError {
  return new AppError("GAME_NOT_FINAL", 409, `Game ${game_id} is not finished yet`);
}

function to_story_game(game: StoryGameRow): StoryGame | undefined {
  if (game.home_goals === null || game.away_goals === null || game.ended_in === null) {
    return undefined;
  }
  return {
    ...game,
    home_goals: game.home_goals,
    away_goals: game.away_goals,
    ended_in: game.ended_in,
  };
}

/** Writes the AI preview (before) and the AI summary (after) of a game from its fact sheet. */
export class StoryGenerationService {
  private readonly season_cache = new Map<
    string,
    { loaded_at: number; data: Promise<SeasonData> }
  >();

  constructor(
    private readonly repository: StoriesRepository,
    private readonly inputs_repository: ModelInputsRepository,
    private readonly llm: LlmClient | undefined,
    private readonly clock: Clock,
    private readonly options: GenerationOptions = {},
  ) {}

  /** Form, meetings, table and "Data says" as of puck drop (also for past games: demo replays). */
  async generate_preview(game_id: string): Promise<GenerationResult> {
    const game = await this.repository.find_game(game_id);
    if (!game) {
      throw game_not_found(game_id);
    }
    const data = await this.load_season(game.season);
    const meetings = await this.repository.list_meetings(
      game.home_team_id,
      game.away_team_id,
      game.start_time,
      MEETING_COUNT,
    );
    const sheet = build_preview_fact_sheet(
      to_preview_input(data, game, meetings, this.predict(data, game), this.clock()),
    );
    return this.write_and_save("preview", game_id, sheet, `${game.home_team} vs ${game.away_team}`);
  }

  async generate_summary(game_id: string): Promise<GenerationResult> {
    const row = await this.repository.find_game(game_id);
    if (!row) {
      throw game_not_found(game_id);
    }
    const game = row.status === "final" ? to_story_game(row) : undefined;
    if (!game) {
      throw game_not_final(game_id);
    }
    const data = row.data_source === "liiga_api" ? await this.load_season(row.season) : undefined;
    const sheet = build_fact_sheet(
      to_fact_sheet_input(
        game,
        await this.repository.list_goals(game_id),
        data
          ? compute_season_facts(
              data,
              game,
              this.options.season_simulations ?? model_config.season_simulations,
            )
          : { standings: [], odds: [], next_games: [] },
        this.clock(),
      ),
    );
    return this.write_and_save("summary", game_id, sheet, build_headline(sheet));
  }

  private async write_and_save(
    story_type: StoryType,
    game_id: string,
    sheet: FactSheet,
    headline: string,
  ): Promise<GenerationResult> {
    const fact_sheet_id = await this.repository.save_fact_sheet(sheet);
    const known_names = await this.repository.list_known_names();
    const written = await write_story(this.llm, story_type, sheet, known_names);
    const label_text = written.source === "template" ? TEMPLATE_LABELS[story_type] : AI_STORY_LABEL;
    const story_id = await this.repository.insert_story({
      game_id,
      story_type,
      language: STORY_LANGUAGE,
      headline,
      body: written.body,
      fact_sheet_id,
      traffic_light: written.traffic_light,
      check_result: written.check,
      generation_attempts: written.attempts,
      prompt_version: written.prompt_version,
      model_name: written.model_name,
      raw_output: written.raw_output,
      source: written.source,
      publish: written.traffic_light === "green" ? { label_text, at: this.clock() } : null,
    });
    return { story_id, traffic_light: written.traffic_light, source: written.source };
  }

  /** The model's numbers for the game, or null when it can't be predicted (not in the season). */
  private predict(data: SeasonData, game: StoryGameRow): GamePrediction | null {
    try {
      return predict_from_season(
        data,
        { ...game, status: "scheduled", home_goals: null, away_goals: null, ended_in: null },
        { stakes_simulations: this.options.stakes_simulations },
      );
    } catch {
      return null;
    }
  }

  private load_season(season: string): Promise<SeasonData> {
    const now = Date.now();
    const cached = this.season_cache.get(season);
    if (cached && now - cached.loaded_at < SEASON_CACHE_MS) {
      return cached.data;
    }
    const data = this.inputs_repository.load_season(season).then(to_season_data);
    data.catch(() => this.season_cache.delete(season));
    this.season_cache.set(season, { loaded_at: now, data });
    return data;
  }
}
