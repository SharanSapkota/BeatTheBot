import { Router } from "express";
import type { DemoController } from "./demo_controller";

export function create_demo_routes(demo_controller: DemoController): Router {
  const router = Router();
  router.get("/game_day", demo_controller.get_game_day);
  router.get("/games/:game_id", demo_controller.get_game);
  return router;
}
