import { Router } from "express";
import type { StoriesController } from "./stories_controller";

/** Mounted on /games. */
export function create_story_routes(controller: StoriesController): Router {
  const router = Router();
  router.get("/:game_id/stories", controller.get_story);
  return router;
}

/** Mounted on /demo/games (only when the demo replay is on). */
export function create_demo_story_routes(controller: StoriesController): Router {
  const router = Router();
  router.get("/:game_id/stories", controller.get_demo_story);
  return router;
}
