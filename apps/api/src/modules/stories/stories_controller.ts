import type { RequestHandler } from "express";
import {
  replay_moment_schema,
  story_report_request_schema,
  type ApiSuccess,
  type GameStories,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { set_cache_control } from "../../common/cache_control";
import { find_auth } from "../auth/auth_context";
import { game_not_found } from "../games/games_service";
import { story_not_found, type StoriesService } from "./stories_service";

const game_params_schema = z.object({ game_id: z.string() });
const story_params_schema = z.object({ story_id: z.string() });
const demo_query_schema = z.object({ moment: replay_moment_schema });

function parse_uuid(value: string, not_found: (id: string) => Error): string {
  if (!z.uuid().safeParse(value).success) {
    throw not_found(value);
  }
  return value;
}

export class StoriesController {
  constructor(private readonly stories_service: StoriesService) {}

  /** GET /games/:id/stories → { preview, summary }: published only, else null. */
  get_stories: RequestHandler = async (req, res) => {
    const game_id = parse_uuid(game_params_schema.parse(req.params).game_id, game_not_found);
    const response: ApiSuccess<GameStories> = {
      data: await this.stories_service.get_game_stories(game_id),
    };
    set_cache_control(res, false);
    res.json(response);
  };

  get_demo_stories: RequestHandler = async (req, res) => {
    const game_id = parse_uuid(game_params_schema.parse(req.params).game_id, game_not_found);
    const { moment } = demo_query_schema.parse(req.query);
    const response: ApiSuccess<GameStories> = {
      data: await this.stories_service.get_demo_game_stories(game_id, moment),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  /** "Report an error": signed in or not; rate limited per IP in the routes. */
  report: RequestHandler = async (req, res) => {
    const story_id = parse_uuid(story_params_schema.parse(req.params).story_id, story_not_found);
    const { reason } = story_report_request_schema.parse(req.body);
    await this.stories_service.report(story_id, reason, find_auth(req)?.user_id ?? null);
    const response: ApiSuccess<{ received: true }> = { data: { received: true } };
    res.status(201).json(response);
  };
}
