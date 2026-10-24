import type { RequestHandler } from "express";
import type {
  ApiSuccess,
  GameDay,
  GameDetail,
  GameSummary,
  SportsDay,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { set_cache_control } from "../../common/cache_control";
import {
  game_day_params_schema,
  game_list_query_schema,
  game_params_schema,
  sport_query_schema,
  sports_query_schema,
} from "./games_schemas";
import { game_not_found, type GamesService } from "./games_service";

function has_live_game(games: readonly GameSummary[]): boolean {
  return games.some((game) => game.state === "live");
}

export class GamesController {
  constructor(private readonly games_service: GamesService) {}

  get_game_day: RequestHandler = async (req, res) => {
    const { date } = game_day_params_schema.parse(req.params);
    const { sport } = sport_query_schema.parse(req.query);
    const response: ApiSuccess<GameDay> = {
      data: await this.games_service.get_game_day(date, sport),
    };
    set_cache_control(res, has_live_game(response.data.games));
    res.json(response);
  };

  get_sports: RequestHandler = async (req, res) => {
    const { date } = sports_query_schema.parse(req.query);
    const response: ApiSuccess<SportsDay> = {
      data: await this.games_service.get_sports_day(date),
    };
    set_cache_control(
      res,
      response.data.sports.some((sport) => sport.live_count > 0),
    );
    res.json(response);
  };

  list_games: RequestHandler = async (req, res) => {
    const query = game_list_query_schema.parse(req.query);
    const response: ApiSuccess<GameSummary[]> = {
      data: await this.games_service.list_games(query),
    };
    set_cache_control(res, has_live_game(response.data));
    res.json(response);
  };

  get_game: RequestHandler = async (req, res) => {
    const { game_id } = game_params_schema.parse(req.params);
    // A malformed id can't match any game.
    if (!z.uuid().safeParse(game_id).success) {
      throw game_not_found(game_id);
    }
    const response: ApiSuccess<GameDetail> = {
      data: await this.games_service.get_game_detail(game_id),
    };
    set_cache_control(res, response.data.state === "live");
    res.json(response);
  };
}
