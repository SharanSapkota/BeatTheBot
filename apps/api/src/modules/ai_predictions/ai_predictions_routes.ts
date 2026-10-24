import { Router } from "express";
import type { AiPredictionsController } from "./ai_predictions_controller";

/** Mounted on /games next to the games routes. */
export function create_ai_prediction_routes(controller: AiPredictionsController): Router {
  const router = Router();
  router.get("/:game_id/ai_prediction", controller.get_prediction);
  router.get("/:game_id/win_chance", controller.get_win_chance);
  return router;
}

/** Mounted on /standings/odds. */
export function create_season_odds_routes(controller: AiPredictionsController): Router {
  const router = Router();
  router.get("/", controller.get_season_odds);
  return router;
}

/** Mounted on /demo/games when the demo replay is enabled. */
export function create_demo_ai_routes(controller: AiPredictionsController): Router {
  const router = Router();
  router.get("/:game_id/ai_prediction", controller.get_demo_prediction);
  router.get("/:game_id/win_chance", controller.get_demo_win_chance);
  return router;
}
