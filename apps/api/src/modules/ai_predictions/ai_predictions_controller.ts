import type { RequestHandler } from "express";
import type { AiPrediction, ApiSuccess, SeasonOdds, WinChance } from "@voita_kone/shared_types";
import { z } from "zod";
import { set_cache_control } from "../../common/cache_control";
import { game_not_found } from "../games/games_service";
import { demo_query_schema, game_params_schema } from "./ai_predictions_schemas";
import type { AiPredictionsService } from "./ai_predictions_service";
import type { DemoAiService } from "./demo_ai_service";

function parse_game_id(params: unknown): string {
  const { game_id } = game_params_schema.parse(params);
  // A malformed id can't match any game.
  if (!z.uuid().safeParse(game_id).success) {
    throw game_not_found(game_id);
  }
  return game_id;
}

export class AiPredictionsController {
  constructor(
    private readonly service: AiPredictionsService,
    private readonly demo_service: DemoAiService | undefined,
  ) {}

  get_prediction: RequestHandler = async (req, res) => {
    const response: ApiSuccess<AiPrediction> = {
      data: await this.service.get_prediction(parse_game_id(req.params)),
    };
    set_cache_control(res, false);
    res.json(response);
  };

  get_win_chance: RequestHandler = async (req, res) => {
    const response: ApiSuccess<WinChance> = {
      data: await this.service.get_win_chance(parse_game_id(req.params)),
    };
    set_cache_control(res, response.data.state === "live");
    res.json(response);
  };

  get_season_odds: RequestHandler = async (_req, res) => {
    const response: ApiSuccess<SeasonOdds> = { data: await this.service.get_season_odds() };
    set_cache_control(res, false);
    res.json(response);
  };

  // Replays are placed relative to "now", so they are never cached.

  get_demo_prediction: RequestHandler = async (req, res) => {
    const { moment } = demo_query_schema.parse(req.query);
    const response: ApiSuccess<AiPrediction> = {
      data: await this.require_demo().get_prediction(parse_game_id(req.params), moment),
    };
    set_cache_control(res, true);
    res.json(response);
  };

  get_demo_win_chance: RequestHandler = async (req, res) => {
    const { moment } = demo_query_schema.parse(req.query);
    const response: ApiSuccess<WinChance> = {
      data: await this.require_demo().get_win_chance(parse_game_id(req.params), moment),
    };
    set_cache_control(res, true);
    res.json(response);
  };

  private require_demo(): DemoAiService {
    if (!this.demo_service) {
      throw new Error("Demo routes are mounted only when the demo replay is enabled");
    }
    return this.demo_service;
  }
}
