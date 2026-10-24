import { Router, type RequestHandler } from "express";
import type { EditorController } from "./editor_controller";
import type { StoriesController } from "./stories_controller";

/** Mounted on /games. */
export function create_story_routes(controller: StoriesController): Router {
  const router = Router();
  router.get("/:game_id/stories", controller.get_story);
  return router;
}

/** Mounted on /stories. Reports are rate limited per IP. */
export function create_story_report_routes(
  controller: StoriesController,
  report_rate_limit: RequestHandler,
): Router {
  const router = Router();
  router.post("/:story_id/reports", report_rate_limit, controller.report);
  return router;
}

/** Mounted on /demo/games (only when the demo replay is on). */
export function create_demo_story_routes(controller: StoriesController): Router {
  const router = Router();
  router.get("/:game_id/stories", controller.get_demo_story);
  return router;
}

/** Mounted on /editor/stories (role editor or admin). */
export function create_editor_routes(controller: EditorController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/:story_id/approve", controller.approve);
  router.post("/:story_id/edit", controller.edit);
  router.post("/:story_id/reject", controller.reject);
  return router;
}
