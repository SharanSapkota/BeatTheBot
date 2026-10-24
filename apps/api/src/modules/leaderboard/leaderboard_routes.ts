import { Router } from "express";
import type { LeaderboardController } from "./leaderboard_controller";

export function create_leaderboard_routes(controller: LeaderboardController): Router {
  const router = Router();
  router.get("/", controller.get_leaderboard);
  return router;
}
