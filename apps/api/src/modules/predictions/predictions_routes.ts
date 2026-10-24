import { Router } from "express";
import type { PredictionsController } from "./predictions_controller";

/** Mounted on /games. */
export function create_game_prediction_routes(controller: PredictionsController): Router {
  const router = Router();
  router.post("/:game_id/predictions", controller.create);
  router.put("/:game_id/predictions", controller.update);
  return router;
}

/** Mounted on /me/predictions. */
export function create_my_prediction_routes(controller: PredictionsController): Router {
  const router = Router();
  router.get("/", controller.list_mine);
  return router;
}
