import { Router } from "express";
import type { GamesController } from "./games_controller";

export function create_game_day_routes(games_controller: GamesController): Router {
  const router = Router();
  router.get("/:date", games_controller.get_game_day);
  return router;
}

export function create_games_routes(games_controller: GamesController): Router {
  const router = Router();
  router.get("/", games_controller.list_games);
  router.get("/:game_id", games_controller.get_game);
  return router;
}

export function create_sports_routes(games_controller: GamesController): Router {
  const router = Router();
  router.get("/", games_controller.get_sports);
  return router;
}
