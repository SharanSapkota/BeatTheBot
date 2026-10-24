import type { RequestHandler } from "express";
import {
  replay_moment_schema,
  story_type_schema,
  type ApiSuccess,
  type Story,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { set_cache_control } from "../../common/cache_control";
import { game_not_found } from "../games/games_service";
import type { StoriesService } from "./stories_service";

const params_schema = z.object({ game_id: z.string() });
const query_schema = z.object({ type: story_type_schema.default("what_it_means") });
const demo_query_schema = query_schema.extend({ moment: replay_moment_schema });

function parse_game_id(params: unknown): string {
  const { game_id } = params_schema.parse(params);
  if (!z.uuid().safeParse(game_id).success) {
    throw game_not_found(game_id);
  }
  return game_id;
}

export class StoriesController {
  constructor(private readonly stories_service: StoriesService) {}

  get_story: RequestHandler = async (req, res) => {
    const game_id = parse_game_id(req.params);
    const { type } = query_schema.parse(req.query);
    const response: ApiSuccess<Story | null> = {
      data: await this.stories_service.get_published(game_id, type),
    };
    set_cache_control(res, false);
    res.json(response);
  };

  get_demo_story: RequestHandler = async (req, res) => {
    const game_id = parse_game_id(req.params);
    const { type, moment } = demo_query_schema.parse(req.query);
    const response: ApiSuccess<Story | null> = {
      data: await this.stories_service.get_demo_published(game_id, type, moment),
    };
    res.set("Cache-Control", "no-store").json(response);
  };
}
