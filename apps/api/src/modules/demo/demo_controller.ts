import type { RequestHandler } from "express";
import {
  replay_moment_schema,
  sport_schema,
  type ApiSuccess,
  type GameDay,
  type GameDetail,
  type SportsDay,
} from "@voita_kone/shared_types";
import { DEFAULT_SPORT } from "@voita_kone/scoring";
import { z } from "zod";
import { set_cache_control } from "../../common/cache_control";
import { game_not_found } from "../games/games_service";
import type { DemoReplayService } from "./demo_replay_service";

const moment_query_schema = z.object({ moment: replay_moment_schema });
const game_day_query_schema = moment_query_schema.extend({
  sport: sport_schema.default(DEFAULT_SPORT),
});
const game_params_schema = z.object({ game_id: z.string() });

export class DemoController {
  constructor(private readonly demo_replay_service: DemoReplayService) {}

  // Replays are placed relative to "now", so they are never cached.

  get_game_day: RequestHandler = async (req, res) => {
    const { moment, sport } = game_day_query_schema.parse(req.query);
    const response: ApiSuccess<GameDay> = {
      data: await this.demo_replay_service.get_game_day(moment, sport),
    };
    set_cache_control(res, true);
    res.json(response);
  };

  get_sports: RequestHandler = async (_req, res) => {
    const response: ApiSuccess<SportsDay> = {
      data: await this.demo_replay_service.get_sports_day(),
    };
    set_cache_control(res, true);
    res.json(response);
  };

  get_game: RequestHandler = async (req, res) => {
    const { game_id } = game_params_schema.parse(req.params);
    const { moment } = moment_query_schema.parse(req.query);
    if (!z.uuid().safeParse(game_id).success) {
      throw game_not_found(game_id);
    }
    const response: ApiSuccess<GameDetail> = {
      data: await this.demo_replay_service.get_game_detail(game_id, moment),
    };
    set_cache_control(res, true);
    res.json(response);
  };
}
