import type { RequestHandler } from "express";
import {
  prediction_request_schema,
  type ApiSuccess,
  type UserPrediction,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { require_auth } from "../auth/auth_context";
import { game_not_found } from "../games/games_service";
import type { PredictionsService } from "./predictions_service";

const game_params_schema = z.object({ game_id: z.string() });
const list_query_schema = z.object({ game_id: z.uuid().optional() });

/** A malformed id can't match any game. */
function parse_game_id(params: unknown): string {
  const { game_id } = game_params_schema.parse(params);
  if (!z.uuid().safeParse(game_id).success) {
    throw game_not_found(game_id);
  }
  return game_id;
}

export class PredictionsController {
  constructor(private readonly predictions_service: PredictionsService) {}

  create: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const game_id = parse_game_id(req.params);
    const pick = prediction_request_schema.parse(req.body);
    const response: ApiSuccess<UserPrediction> = {
      data: await this.predictions_service.create(user_id, game_id, pick),
    };
    res.status(201).json(response);
  };

  update: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const game_id = parse_game_id(req.params);
    const pick = prediction_request_schema.parse(req.body);
    const response: ApiSuccess<UserPrediction> = {
      data: await this.predictions_service.update(user_id, game_id, pick),
    };
    res.json(response);
  };

  list_mine: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const { game_id } = list_query_schema.parse(req.query);
    const response: ApiSuccess<UserPrediction[]> = {
      data: await this.predictions_service.list(user_id, game_id),
    };
    res.set("Cache-Control", "no-store").json(response);
  };
}
