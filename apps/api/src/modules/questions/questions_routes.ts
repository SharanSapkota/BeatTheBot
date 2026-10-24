import { Router } from "express";
import type { QuestionsController } from "./questions_controller";

/** Mounted on /games. */
export function create_game_question_routes(controller: QuestionsController): Router {
  const router = Router();
  router.get("/:game_id/questions", controller.list);
  return router;
}

/** Mounted on /questions. */
export function create_question_routes(controller: QuestionsController): Router {
  const router = Router();
  router.post("/:question_id/answers", controller.answer);
  return router;
}

/** Mounted on /demo/games (only when the demo replay is on). Answers stay on the device. */
export function create_demo_question_routes(controller: QuestionsController): Router {
  const router = Router();
  router.get("/:game_id/questions", controller.list_demo);
  return router;
}
